/**
 * Secret medal shaders for placement pokeballs (1st / 2nd / 3rd place).
 *
 * Sprites render via canvas2d `drawImage`, so a "shader" here means
 * pre-processing the sprite into an offscreen canvas: we read each pixel's
 * luminance and remap it through a metallic gold/silver/bronze colour ramp,
 * preserving the original alpha channel (and therefore the pixel-art edges).
 */

export type Medal = "gold" | "silver" | "bronze";

type RGB = [number, number, number];

// 3-stop metallic ramps: [shadow, midtone, highlight].
const RAMPS: Record<Medal, [RGB, RGB, RGB]> = {
	gold: [
		[60, 42, 0],
		[212, 175, 55],
		[255, 245, 200],
	],
	silver: [
		[58, 60, 72],
		[176, 182, 196],
		[255, 255, 255],
	],
	bronze: [
		[48, 24, 8],
		[176, 110, 58],
		[245, 205, 155],
	],
};

/**
 * Detect a placement medal from a pokeball id string. Special placement balls
 * encode "1st" / "2nd" / "3rd" (or first/second/third) in their identifier.
 */
export function getMedalFromBallId(id: string | null | undefined): Medal | null {
	if (!id) return null;
	const s = id.toLowerCase();
	if (/(^|[^0-9])1st([^0-9]|$)|first|gold/.test(s)) return "gold";
	if (/(^|[^0-9])2nd([^0-9]|$)|second|silver/.test(s)) return "silver";
	if (/(^|[^0-9])3rd([^0-9]|$)|third|bronze/.test(s)) return "bronze";
	return null;
}

/** Metal ramp (shadow/midtone/highlight, 0-255) for the GPU shader to consume. */
export function getMedalRamp(medal: Medal): [RGB, RGB, RGB] {
	return RAMPS[medal];
}

function sampleRamp(ramp: [RGB, RGB, RGB], t: number): RGB {
	const [lo, mid, hi] = ramp;
	if (t <= 0.5) {
		const k = t / 0.5;
		return [
			lo[0] + (mid[0] - lo[0]) * k,
			lo[1] + (mid[1] - lo[1]) * k,
			lo[2] + (mid[2] - lo[2]) * k,
		];
	}
	const k = (t - 0.5) / 0.5;
	return [
		mid[0] + (hi[0] - mid[0]) * k,
		mid[1] + (hi[1] - mid[1]) * k,
		mid[2] + (hi[2] - mid[2]) * k,
	];
}

/**
 * Build a metallic-tinted copy of a sprite for the given medal.
 * @param source - A loaded image or canvas (must be same-origin for pixel read)
 * @param medal - Which metal ramp to apply
 * @returns An offscreen canvas at the source's natural resolution
 */
export function applyMedalShader(
	source: HTMLImageElement | HTMLCanvasElement,
	medal: Medal,
): HTMLCanvasElement {
	const w =
		source instanceof HTMLImageElement ? source.naturalWidth : source.width;
	const h =
		source instanceof HTMLImageElement ? source.naturalHeight : source.height;

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;

	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(source, 0, 0, w, h);

	const image = ctx.getImageData(0, 0, w, h);
	const data = image.data;
	const ramp = RAMPS[medal];

	for (let i = 0; i < data.length; i += 4) {
		const a = data[i + 3];
		if (a === 0) continue;

		// Perceptual luminance of the original pixel.
		let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
		// Punch up contrast so the metal reads as shiny rather than flat.
		lum = Math.max(0, Math.min(255, (lum - 128) * 1.25 + 128));

		const [r, g, b] = sampleRamp(ramp, lum / 255);
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
		// alpha preserved
	}

	ctx.putImageData(image, 0, 0);
	return canvas;
}
