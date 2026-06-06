"use client";

import Matter from "matter-js";
import { useEffect, useRef, useState } from "react";
import { MedalShaderGL } from "@/lib/medal-shader-gl";
import { getSpriteHitbox, type Point, scaleHitbox } from "@/lib/physics-utils";
import { ALL_PUBMON, getPubMonSprite, type PubMon } from "@/lib/pokemon-data";
import { applyMedalShader, type Medal } from "@/lib/sprite-shader";

const SPRITE_SIZE = 128; // Display size of each spawned PubMon
const HITBOX_RES = 64; // Resolution hitboxes are generated at

interface SpawnMeta {
	pubmon: PubMon;
	img: HTMLImageElement;
	centroid: Point; // sprite top-left offset from body center
	medal: Medal | null; // placement shader to apply
	phase: number; // per-mon time offset so sparkles desync
	cpuShaded?: HTMLCanvasElement | null; // CPU fallback tinted sprite
	cpuShadeAttempted?: boolean; // guard so we only build the fallback once
}

const SANDBOX_LABEL = "sandbox-mon";

export function PhysicsSandbox() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<Matter.Engine | null>(null);
	const metaRef = useRef<Map<number, SpawnMeta>>(new Map());
	const medalGLRef = useRef<MedalShaderGL | null>(null);

	// Render-loop options (mirrored into refs so the RAF closure sees updates)
	const [showHitbox, setShowHitbox] = useState(true);
	const [showSprite, setShowSprite] = useState(true);
	const [gravityOn, setGravityOn] = useState(true);
	const showHitboxRef = useRef(showHitbox);
	const showSpriteRef = useRef(showSprite);
	showHitboxRef.current = showHitbox;
	showSpriteRef.current = showSprite;

	const [count, setCount] = useState(0);
	const [selectedSprite, setSelectedSprite] = useState(
		ALL_PUBMON[0]?.sprite ?? "",
	);
	const [selectedMedal, setSelectedMedal] = useState<Medal | "none">("none");
	const selectedMedalRef = useRef<Medal | "none">(selectedMedal);
	selectedMedalRef.current = selectedMedal;

	// Keep gravity in sync with the toggle.
	useEffect(() => {
		if (engineRef.current) engineRef.current.gravity.y = gravityOn ? 1 : 0;
	}, [gravityOn]);

	// Spawn a PubMon into the world. Hitbox generation is async.
	const spawn = (pubmon: PubMon) => {
		const engine = engineRef.current;
		const canvas = canvasRef.current;
		if (!engine || !canvas) return;

		const spritePath = getPubMonSprite(pubmon.sprite, pubmon.spriteVariant);
		const x = 120 + Math.random() * Math.max(1, canvas.width - 240);
		const y = 120;

		const finalize = (vertices: Matter.Vector[], centroid: Point) => {
			const body = Matter.Bodies.fromVertices(x, y, [vertices], {
				restitution: 0.5,
				friction: 0.4,
				frictionAir: 0.01,
				label: SANDBOX_LABEL,
			});
			Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);

			const img = new Image();
			img.src = spritePath;

			const medal = selectedMedalRef.current;
			metaRef.current.set(body.id, {
				pubmon,
				img,
				centroid,
				medal: medal === "none" ? null : medal,
				phase: Math.random() * 10,
			});
			Matter.World.add(engine.world, body);
			setCount((c) => c + 1);
		};

		getSpriteHitbox(spritePath, HITBOX_RES, HITBOX_RES)
			.then((hitbox) => {
				const scaled = scaleHitbox(
					hitbox,
					HITBOX_RES,
					HITBOX_RES,
					SPRITE_SIZE,
					SPRITE_SIZE,
				);
				const cx = scaled.reduce((s, p) => s + p.x, 0) / scaled.length;
				const cy = scaled.reduce((s, p) => s + p.y, 0) / scaled.length;
				const centered = scaled.map((p) => ({ x: p.x - cx, y: p.y - cy }));
				finalize(centered as Matter.Vector[], { x: cx, y: cy });
			})
			.catch((err) => {
				console.error("hitbox generation failed, using circle", err);
				const r = SPRITE_SIZE / 2;
				const circle: Point[] = Array.from({ length: 12 }, (_, i) => {
					const a = (i / 12) * Math.PI * 2;
					return { x: Math.cos(a) * r, y: Math.sin(a) * r };
				});
				finalize(circle as Matter.Vector[], { x: r, y: r });
			});
	};
	const spawnRef = useRef(spawn);
	spawnRef.current = spawn;

	const clearAll = () => {
		const engine = engineRef.current;
		if (!engine) return;
		const bodies = Matter.Composite.allBodies(engine.world).filter(
			(b) => b.label === SANDBOX_LABEL,
		);
		Matter.World.remove(engine.world, bodies);
		metaRef.current.clear();
		setCount(0);
	};

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		resize();

		// GPU medal shader (recolor + animated sparkle). Falls back to CPU recolor.
		const medalGL = new MedalShaderGL(SPRITE_SIZE);
		medalGLRef.current = medalGL;

		const engine = Matter.Engine.create();
		engine.gravity.y = 1;
		engineRef.current = engine;

		const wallThickness = 100;
		const makeWalls = () => [
			Matter.Bodies.rectangle(
				canvas.width / 2,
				canvas.height + wallThickness / 2,
				canvas.width * 2,
				wallThickness,
				{ isStatic: true, label: "wall" },
			),
			Matter.Bodies.rectangle(
				-wallThickness / 2,
				canvas.height / 2,
				wallThickness,
				canvas.height * 2,
				{ isStatic: true, label: "wall" },
			),
			Matter.Bodies.rectangle(
				canvas.width + wallThickness / 2,
				canvas.height / 2,
				wallThickness,
				canvas.height * 2,
				{ isStatic: true, label: "wall" },
			),
		];
		Matter.World.add(engine.world, makeWalls());

		// Mouse dragging.
		const mouse = Matter.Mouse.create(canvas);
		const mouseConstraint = Matter.MouseConstraint.create(engine, {
			mouse,
			constraint: { stiffness: 0.9, render: { visible: false } } as any,
		});
		Matter.World.add(engine.world, mouseConstraint);

		const runner = Matter.Runner.create();
		Matter.Runner.run(runner, engine);

		let raf = 0;
		const render = () => {
			const timeSec = performance.now() / 1000;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "#1a1a2e";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Subtle grid for spatial reference.
			ctx.strokeStyle = "rgba(255,255,255,0.04)";
			ctx.lineWidth = 1;
			for (let gx = 0; gx < canvas.width; gx += 32) {
				ctx.beginPath();
				ctx.moveTo(gx, 0);
				ctx.lineTo(gx, canvas.height);
				ctx.stroke();
			}
			for (let gy = 0; gy < canvas.height; gy += 32) {
				ctx.beginPath();
				ctx.moveTo(0, gy);
				ctx.lineTo(canvas.width, gy);
				ctx.stroke();
			}

			const bodies = Matter.Composite.allBodies(engine.world);
			for (const body of bodies) {
				if (body.label !== SANDBOX_LABEL) continue;
				const meta = metaRef.current.get(body.id);

				if (showSpriteRef.current && meta && meta.img.complete) {
					let source: HTMLImageElement | HTMLCanvasElement = meta.img;

					if (meta.medal) {
						if (medalGL.ok) {
							// GPU path: recolor + animated sparkle, ~free per frame.
							source = medalGL.render(
								meta.img,
								meta.medal,
								timeSec + meta.phase,
							);
						} else {
							// CPU fallback: static metallic recolor, built once.
							if (!meta.cpuShadeAttempted) {
								meta.cpuShadeAttempted = true;
								try {
									meta.cpuShaded = applyMedalShader(meta.img, meta.medal);
								} catch (err) {
									console.error("medal shader failed", err);
									meta.cpuShaded = null;
								}
							}
							source = meta.cpuShaded ?? meta.img;
						}
					}

					ctx.save();
					ctx.translate(body.position.x, body.position.y);
					ctx.rotate(body.angle);
					ctx.imageSmoothingEnabled = false;
					ctx.drawImage(
						source,
						-meta.centroid.x,
						-meta.centroid.y,
						SPRITE_SIZE,
						SPRITE_SIZE,
					);
					ctx.restore();
				}

				if (showHitboxRef.current && body.vertices.length) {
					ctx.strokeStyle = "#63c74d";
					ctx.fillStyle = "rgba(99,199,77,0.12)";
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.moveTo(body.vertices[0].x, body.vertices[0].y);
					for (let i = 1; i < body.vertices.length; i++) {
						ctx.lineTo(body.vertices[i].x, body.vertices[i].y);
					}
					ctx.closePath();
					ctx.fill();
					ctx.stroke();

					// Vertices as dots.
					ctx.fillStyle = "#e43b44";
					for (const v of body.vertices) {
						ctx.beginPath();
						ctx.arc(v.x, v.y, 2, 0, Math.PI * 2);
						ctx.fill();
					}

					// Center of mass.
					ctx.fillStyle = "#f6d743";
					ctx.beginPath();
					ctx.arc(body.position.x, body.position.y, 3, 0, Math.PI * 2);
					ctx.fill();

					// Label.
					if (meta) {
						ctx.fillStyle = "#fff";
						ctx.font = "10px monospace";
						ctx.textAlign = "center";
						ctx.fillText(
							`${meta.pubmon.name} (${body.vertices.length}v)`,
							body.position.x,
							body.bounds.min.y - 6,
						);
					}
				}
			}

			raf = requestAnimationFrame(render);
		};
		render();

		window.addEventListener("resize", resize);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", resize);
			Matter.Runner.stop(runner);
			Matter.World.clear(engine.world, false);
			Matter.Engine.clear(engine);
			metaRef.current.clear();
			engineRef.current = null;
			medalGL.dispose();
			medalGLRef.current = null;
		};
	}, []);

	const sorted = [...ALL_PUBMON].sort((a, b) => a.id - b.id);
	const selected = sorted.find((m) => m.sprite === selectedSprite);

	const btn =
		"px-3 py-1.5 text-xs font-mono border-2 border-black bg-white text-black active:translate-y-px select-none cursor-pointer";

	return (
		<div className="fixed inset-0 overflow-hidden bg-[#1a1a2e]">
			<canvas ref={canvasRef} className="block" style={{ cursor: "grab" }} />

			{/* Control panel */}
			<div
				className="absolute top-3 left-3 flex flex-col gap-2 p-3 border-2 border-black bg-[#f5f0e1] shadow-lg"
				style={{ maxWidth: 280 }}
			>
				<div className="font-mono text-sm font-bold text-black">
					Hitbox Sandbox
				</div>

				<select
					className="px-2 py-1 text-xs font-mono border-2 border-black bg-white text-black"
					value={selectedSprite}
					onChange={(e) => setSelectedSprite(e.target.value)}
				>
					{sorted.map((m) => (
						<option key={m.id} value={m.sprite}>
							#{m.id} {m.name} ({m.type})
						</option>
					))}
				</select>

				<select
					className="px-2 py-1 text-xs font-mono border-2 border-black bg-white text-black"
					value={selectedMedal}
					onChange={(e) => setSelectedMedal(e.target.value as Medal | "none")}
				>
					<option value="none">No medal (normal)</option>
					<option value="gold">🥇 Gold (1st)</option>
					<option value="silver">🥈 Silver (2nd)</option>
					<option value="bronze">🥉 Bronze (3rd)</option>
				</select>

				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						className={btn}
						onClick={() => selected && spawn(selected)}
					>
						Spawn
					</button>
					<button
						type="button"
						className={btn}
						onClick={() => {
							const r = sorted[Math.floor(Math.random() * sorted.length)];
							if (r) spawn(r);
						}}
					>
						Spawn Random
					</button>
					<button type="button" className={btn} onClick={clearAll}>
						Clear ({count})
					</button>
				</div>

				<div className="flex flex-col gap-1 pt-1 text-xs font-mono text-black">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={showHitbox}
							onChange={(e) => setShowHitbox(e.target.checked)}
						/>
						Show hitboxes
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={showSprite}
							onChange={(e) => setShowSprite(e.target.checked)}
						/>
						Show sprites
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={gravityOn}
							onChange={(e) => setGravityOn(e.target.checked)}
						/>
						Gravity
					</label>
				</div>

				<div className="pt-1 text-[10px] font-mono leading-tight text-gray-600">
					Drag mons to fling them. Green = hull, red = verts, yellow = center of
					mass.
				</div>
			</div>
		</div>
	);
}
