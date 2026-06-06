/**
 * GPU medal shader. Renders a sprite through a WebGL2 fragment shader that
 * recolours it into a metallic gold/silver/bronze ramp AND draws an animated
 * sparkle/sheen — all on the GPU, driven by a `u_time` uniform. The per-frame
 * CPU cost is a handful of uniform writes plus one draw call per medal'd mon.
 *
 * The output is a regular <canvas>, so the existing canvas2d render loop can
 * `drawImage` it exactly like a normal sprite.
 */

import { getMedalRamp, type Medal } from "@/lib/sprite-shader";

const VERT = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform float u_time;     // seconds
uniform vec3 u_ramp0;     // shadow   (0..1)
uniform vec3 u_ramp1;     // midtone
uniform vec3 u_ramp2;     // highlight
uniform vec3 u_sparkle;   // sparkle tint (0..1)

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5
    ? mix(u_ramp0, u_ramp1, t / 0.5)
    : mix(u_ramp1, u_ramp2, (t - 0.5) / 0.5);
}

void main() {
  vec4 texel = texture(u_tex, v_uv);
  if (texel.a < 0.02) {
    outColor = vec4(0.0);
    return;
  }

  // Luminance -> metallic colour ramp, with a contrast punch.
  float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  lum = clamp((lum - 0.5) * 1.25 + 0.5, 0.0, 1.0);
  vec3 metal = ramp(lum);

  // Diagonal metallic sheen sweeping across the body.
  float sweep = sin((v_uv.x + v_uv.y) * 6.2831 - u_time * 2.2);
  float sheen = smoothstep(0.82, 1.0, sweep) * 0.45;

  // Procedural twinkling sparkles on a hashed grid (cross-shaped glints).
  float sparkle = 0.0;
  vec2 g = v_uv * 9.0;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float rnd = hash(id);
  // Sharp, staggered twinkle so only a few cells flash at once.
  float tw = pow(max(0.0, sin(u_time * 3.0 + rnd * 6.2831)), 12.0);
  if (tw > 0.001) {
    float cx = smoothstep(0.07, 0.0, abs(f.x)) * smoothstep(0.45, 0.0, abs(f.y));
    float cy = smoothstep(0.07, 0.0, abs(f.y)) * smoothstep(0.45, 0.0, abs(f.x));
    sparkle = max(cx, cy) * tw;
  }

  vec3 color = metal + vec3(sheen) + u_sparkle * sparkle;
  outColor = vec4(clamp(color, 0.0, 1.0), texel.a);
}`;

export class MedalShaderGL {
	readonly canvas: HTMLCanvasElement;
	private gl: WebGL2RenderingContext | null = null;
	private program: WebGLProgram | null = null;
	private uniforms: Record<string, WebGLUniformLocation | null> = {};
	private textures = new WeakMap<HTMLImageElement | HTMLCanvasElement, WebGLTexture>();

	constructor(size = 128) {
		this.canvas = document.createElement("canvas");
		this.canvas.width = size;
		this.canvas.height = size;

		const gl = this.canvas.getContext("webgl2", {
			premultipliedAlpha: false,
			antialias: false,
		});
		if (!gl) return; // .ok stays false -> caller falls back to CPU recolor

		this.gl = gl;
		const program = this.build(gl);
		if (!program) {
			this.gl = null;
			return;
		}
		this.program = program;
		gl.useProgram(program);

		// Fullscreen quad (triangle strip): pos + uv.
		const quad = new Float32Array([
			-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1,
		]);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

		const aPos = gl.getAttribLocation(program, "a_pos");
		const aUv = gl.getAttribLocation(program, "a_uv");
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
		gl.enableVertexAttribArray(aUv);
		gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

		for (const name of [
			"u_tex",
			"u_time",
			"u_ramp0",
			"u_ramp1",
			"u_ramp2",
			"u_sparkle",
		]) {
			this.uniforms[name] = gl.getUniformLocation(program, name);
		}

		gl.uniform1i(this.uniforms.u_tex, 0);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.viewport(0, 0, size, size);
	}

	get ok(): boolean {
		return this.gl !== null;
	}

	private build(gl: WebGL2RenderingContext): WebGLProgram | null {
		const vs = this.compile(gl, gl.VERTEX_SHADER, VERT);
		const fs = this.compile(gl, gl.FRAGMENT_SHADER, FRAG);
		if (!vs || !fs) return null;
		const program = gl.createProgram();
		if (!program) return null;
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("medal shader link failed:", gl.getProgramInfoLog(program));
			return null;
		}
		return program;
	}

	private compile(
		gl: WebGL2RenderingContext,
		type: number,
		src: string,
	): WebGLShader | null {
		const shader = gl.createShader(type);
		if (!shader) return null;
		gl.shaderSource(shader, src);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error("medal shader compile failed:", gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	private texture(
		gl: WebGL2RenderingContext,
		source: HTMLImageElement | HTMLCanvasElement,
	): WebGLTexture | null {
		let tex = this.textures.get(source);
		if (tex) return tex;
		tex = gl.createTexture() ?? undefined;
		if (!tex) return null;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			source,
		);
		this.textures.set(source, tex);
		return tex;
	}

	/**
	 * Render a sprite with the medal effect at the given time. Returns the
	 * internal canvas to be drawn immediately (it is reused next call).
	 * @param timeSec - Animation time in seconds (+ optional per-mon phase)
	 */
	render(
		source: HTMLImageElement | HTMLCanvasElement,
		medal: Medal,
		timeSec: number,
	): HTMLCanvasElement {
		const gl = this.gl;
		if (!gl || !this.program) return this.canvas;

		const tex = this.texture(gl, source);
		if (!tex) return this.canvas;

		gl.useProgram(this.program);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex);

		const [lo, mid, hi] = getMedalRamp(medal);
		gl.uniform3f(this.uniforms.u_ramp0, lo[0] / 255, lo[1] / 255, lo[2] / 255);
		gl.uniform3f(this.uniforms.u_ramp1, mid[0] / 255, mid[1] / 255, mid[2] / 255);
		gl.uniform3f(this.uniforms.u_ramp2, hi[0] / 255, hi[1] / 255, hi[2] / 255);

		// Sparkle tint biased toward the medal's highlight, kept bright.
		gl.uniform3f(
			this.uniforms.u_sparkle,
			Math.min(1, hi[0] / 255 + 0.2),
			Math.min(1, hi[1] / 255 + 0.2),
			Math.min(1, hi[2] / 255 + 0.2),
		);
		gl.uniform1f(this.uniforms.u_time, timeSec);

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		return this.canvas;
	}

	dispose() {
		const gl = this.gl;
		if (!gl) return;
		const ext = gl.getExtension("WEBGL_lose_context");
		ext?.loseContext();
		this.gl = null;
		this.program = null;
	}
}
