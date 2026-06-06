"use client";

import { AnimatePresence, motion } from "framer-motion";
import Matter from "matter-js";
import { useEffect, useRef, useState } from "react";
import { usePokemonCry } from "@/hooks/use-pokemon-cry";
import { MedalShaderGL } from "@/lib/medal-shader-gl";
import { getSpriteHitbox, type Point, scaleHitbox } from "@/lib/physics-utils";
import { getPubMonSprite, type PubMon } from "@/lib/pokemon-data";
import { applyMedalShader, type Medal } from "@/lib/sprite-shader";

interface PlayCanvasProps {
	pubmon: PubMon;
	onExit: () => void;
	overlay?: boolean; // When true, renders as transparent click-through overlay
	medal?: Medal | null; // Secret placement-ball shader (gold/silver/bronze)
}

type PubMonState = "walking" | "grabbed" | "free";

const SPRITE_SIZE = 192; // Display size of the PubMon
const POKEBALL_SIZE = 48;
const POKEBALL_RADIUS = 48;
const RECOVERY_TIME = 2000; // ms to wait before auto-recovery
const VELOCITY_THRESHOLD = 0.5; // Velocity below which PubMon is considered "resting"

const CUTE_SAYINGS = [
	"I love walks!",
	"*happy noises*",
	"Pet me!",
	"La la la~",
	"So comfy...",
	"Hehe!",
	"Pick me up!",
	"*yawn*",
	"What's over there?",
	"Snack time?",
	"I'm the best!",
	"Wheee~!",
	"*purrs*",
	"Look at me go!",
	"Are we there yet?",
	"*hums a tune*",
	"Feeling great!",
	"Boop!",
	"*wiggles*",
	"Let's explore!",
];

const GRABBED_SAYINGS = [
	"Wheee!",
	"Higher! Higher!",
	"I can fly!",
	"Woooo!",
	"Don't drop me!",
	"*giggles*",
	"This is fun!",
	"I'm so high up!",
];

const FREE_SAYINGS = [
	"Oof...",
	"Dizzy...",
	"*sees stars*",
	"That was wild!",
	"Again! Again!",
	"I'm okay...",
];

const SPEECH_DISPLAY_TIME = 2000; // frames (~2 seconds)
const SPEECH_COOLDOWN_MIN = 2000; // minimum frames between sayings (~3 seconds)
const SPEECH_COOLDOWN_MAX = 4000; // maximum frames between sayings (~7 seconds)

export function PlayCanvas({
	pubmon,
	onExit,
	overlay = false,
	medal = null,
}: PlayCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hitAreaRef = useRef<HTMLDivElement>(null);
	const engineRef = useRef<Matter.Engine | null>(null);
	const pubmonBodyRef = useRef<Matter.Body | null>(null);
	const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
	const [state, setState] = useState<PubMonState>("walking");
	const stateRef = useRef<PubMonState>("walking");
	const [debugMode] = useState(() =>
		typeof window !== "undefined"
			? new URLSearchParams(window.location.search).get("debug") === "true"
			: false,
	);
	const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const isPokeballHoveredRef = useRef<boolean>(false);
	const restingTimerRef = useRef<number>(0);
	const walkDirectionRef = useRef<number>(1);
	const previousDirectionRef = useRef<number>(1);
	const lastPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const frameRef = useRef<number>(0);
	const spriteCentroidRef = useRef<{ x: number; y: number }>({
		x: SPRITE_SIZE / 2,
		y: SPRITE_SIZE / 2,
	});
	const hitboxVerticesRef = useRef<{
		normal: Point[];
		flipped: Point[];
	}>({ normal: [], flipped: [] });
	const { playPokemonCry } = usePokemonCry([pubmon]);
	const speechTextRef = useRef<string>("");
	const speechTimerRef = useRef<number>(0);
	const speechCooldownRef = useRef<number>(
		Math.floor(Math.random() * (SPEECH_COOLDOWN_MAX - SPEECH_COOLDOWN_MIN)) +
			SPEECH_COOLDOWN_MIN,
	);
	const onExitRef = useRef(onExit);
	onExitRef.current = onExit;

	const updateState = (newState: PubMonState) => {
		setState(newState);
		stateRef.current = newState;
		// Trigger an immediate saying on state change
		const sayings =
			newState === "grabbed"
				? GRABBED_SAYINGS
				: newState === "free"
					? FREE_SAYINGS
					: CUTE_SAYINGS;
		speechTextRef.current = sayings[Math.floor(Math.random() * sayings.length)];
		speechTimerRef.current = SPEECH_DISPLAY_TIME;
		speechCooldownRef.current =
			Math.floor(Math.random() * (SPEECH_COOLDOWN_MAX - SPEECH_COOLDOWN_MIN)) +
			SPEECH_COOLDOWN_MIN;
	};

	console.log("STATE", state);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Set canvas size to window size
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		// Create Matter.js engine
		const engine = Matter.Engine.create();
		engine.gravity.y = 1;
		engineRef.current = engine;

		// Secret medal shader (GPU recolor + sparkle; CPU recolor fallback).
		const medalGL = medal ? new MedalShaderGL(SPRITE_SIZE) : null;
		let cpuShaded: HTMLCanvasElement | null = null;
		let cpuShadeTried = false;

		// Create boundaries (walls)
		const wallThickness = 50;
		const walls = [
			// Floor
			Matter.Bodies.rectangle(
				canvas.width / 2,
				canvas.height + wallThickness / 2,
				canvas.width,
				wallThickness,
				{ isStatic: true, label: "floor" },
			),
			// Ceiling
			Matter.Bodies.rectangle(
				canvas.width / 2,
				-wallThickness / 2,
				canvas.width,
				wallThickness,
				{ isStatic: true, label: "ceiling" },
			),
			// Left wall
			Matter.Bodies.rectangle(
				-wallThickness / 2,
				canvas.height / 2,
				wallThickness,
				canvas.height,
				{ isStatic: true, label: "wall-left" },
			),
			// Right wall
			Matter.Bodies.rectangle(
				canvas.width + wallThickness / 2,
				canvas.height / 2,
				wallThickness,
				canvas.height,
				{ isStatic: true, label: "wall-right" },
			),
		];

		Matter.World.add(engine.world, walls);

		// Load sprite and create PubMon body
		const spritePath = getPubMonSprite(pubmon.sprite, pubmon.spriteVariant);

		getSpriteHitbox(spritePath, 64, 64)
			.then((hitbox) => {
				// Scale hitbox to sprite display size
				const scaledHitbox = scaleHitbox(
					hitbox,
					64,
					64,
					SPRITE_SIZE,
					SPRITE_SIZE,
				);

				// Calculate the centroid of the hitbox (center of actual pixels)
				const centerX =
					scaledHitbox.reduce((sum, p) => sum + p.x, 0) / scaledHitbox.length;
				const centerY =
					scaledHitbox.reduce((sum, p) => sum + p.y, 0) / scaledHitbox.length;

				// Store the centroid for sprite rendering
				spriteCentroidRef.current = { x: centerX, y: centerY };

				// Center the hitbox around (0, 0) for Matter.js
				const centeredVertices = scaledHitbox.map((p) => ({
					x: p.x - centerX,
					y: p.y - centerY,
				}));

				// Create flipped version (mirror x-coordinates)
				const flippedVertices = centeredVertices.map((p) => ({
					x: -p.x,
					y: p.y,
				}));

				// Store both versions for direction changes
				hitboxVerticesRef.current = {
					normal: centeredVertices,
					flipped: flippedVertices,
				};

				// Create PubMon body (starting with normal facing left)
				const pubmonBody = Matter.Bodies.fromVertices(
					canvas.width / 2,
					canvas.height / 2,
					[centeredVertices as Matter.Vector[]],
					{
						restitution: 0.6,
						friction: 0.5,
						frictionAir: 0.01,
						label: "pubmon",
					},
				);

				Matter.World.add(engine.world, pubmonBody);
				pubmonBodyRef.current = pubmonBody;

				// Set initial kinematic state (walking mode)
				Matter.Body.setStatic(pubmonBody, false);
				(pubmonBody as any).isKinematic = true;

				// If starting direction is right, flip the vertices to match
				if (walkDirectionRef.current > 0) {
					Matter.Body.setVertices(
						pubmonBody,
						flippedVertices as Matter.Vector[],
					);
					previousDirectionRef.current = 1;
				} else {
					previousDirectionRef.current = -1;
				}

				lastPositionRef.current = {
					x: pubmonBody.position.x,
					y: pubmonBody.position.y,
				};
			})
			.catch((err) => {
				console.error("Failed to generate hitbox:", err);
				// Fallback: create simple circle
				const pubmonBody = Matter.Bodies.circle(
					canvas.width / 2,
					canvas.height / 2,
					SPRITE_SIZE / 2,
					{
						restitution: 0.6,
						friction: 0.5,
						frictionAir: 0.01,
						label: "pubmon",
					},
				);

				Matter.World.add(engine.world, pubmonBody);
				pubmonBodyRef.current = pubmonBody;
				(pubmonBody as any).isKinematic = true;
				lastPositionRef.current = {
					x: pubmonBody.position.x,
					y: pubmonBody.position.y,
				};
			});

		// Create mouse constraint for dragging.
		// We attach Matter.Mouse to the canvas but manually forward events
		// from the hit-area div so the canvas can stay pointer-events: none.
		const mouse = Matter.Mouse.create(canvas);
		const mouseConstraint = Matter.MouseConstraint.create(engine, {
			mouse: mouse,
			constraint: {
				stiffness: 0.8,
				render: { visible: false },
			} as any,
		});

		mouseConstraintRef.current = mouseConstraint;
		Matter.World.add(engine.world, mouseConstraint);

		// Forward mouse/touch events from hit-area div → canvas so Matter.js
		// receives them (canvas has pointer-events: none for click-through).
		const hitArea = hitAreaRef.current;
		const forwardMouse = (e: MouseEvent) => {
			canvas.dispatchEvent(new MouseEvent(e.type, e));
		};
		const forwardTouch = (e: TouchEvent) => {
			canvas.dispatchEvent(
				new TouchEvent(e.type, {
					touches: e.touches,
					targetTouches: e.targetTouches,
					changedTouches: e.changedTouches,
					bubbles: true,
				}),
			);
			e.preventDefault(); // prevent scroll while dragging pubmon
		};
		if (hitArea) {
			hitArea.addEventListener("mousedown", forwardMouse);
			hitArea.addEventListener("mousemove", forwardMouse);
			hitArea.addEventListener("mouseup", forwardMouse);
			hitArea.addEventListener("touchstart", forwardTouch, {
				passive: false,
			});
			hitArea.addEventListener("touchmove", forwardTouch, {
				passive: false,
			});
			hitArea.addEventListener("touchend", forwardTouch);
		}

		// Collision events for landing damping
		Matter.Events.on(engine, "collisionStart", (event) => {
			event.pairs.forEach((pair) => {
				const { bodyA, bodyB } = pair;
				const pubmonBody =
					bodyA.label === "pubmon"
						? bodyA
						: bodyB.label === "pubmon"
							? bodyB
							: null;
				const floor =
					bodyA.label === "floor"
						? bodyA
						: bodyB.label === "floor"
							? bodyB
							: null;

				if (pubmonBody && floor && pubmonBody === pubmonBodyRef.current) {
					// Dampen angular velocity on floor contact
					Matter.Body.setAngularVelocity(
						pubmonBody,
						pubmonBody.angularVelocity * 0.1,
					);
				}
			});
		});

		// Matter.Events.on(engine, "collisionActive", (event) => {
		// 	event.pairs.forEach((pair) => {
		// 		const { bodyA, bodyB } = pair;
		// 		const pubmonBody =
		// 			bodyA.label === "pubmon"
		// 				? bodyA
		// 				: bodyB.label === "pubmon"
		// 					? bodyB
		// 					: null;
		// 		const floor =
		// 			bodyA.label === "floor"
		// 				? bodyA
		// 				: bodyB.label === "floor"
		// 					? bodyB
		// 					: null;

		// 		if (pubmonBody && floor && pubmonBody === pubmonBodyRef.current) {
		// 			// Continue dampening while in contact with floor
		// 			Matter.Body.setAngularVelocity(
		// 				pubmonBody,
		// 				pubmonBody.angularVelocity * 0.7,
		// 			);
		// 		}
		// 	});
		// });

		// Mouse events for interaction
		if (mouseConstraintRef.current) {
			Matter.Events.on(mouseConstraintRef.current, "startdrag", (event) => {
				if (event.body?.label === "pubmon") {
					updateState("grabbed");
					(pubmonBodyRef.current as any).isKinematic = false;
					Matter.Body.setStatic(pubmonBodyRef.current!, false);
				}
			});

			Matter.Events.on(mouseConstraintRef.current, "enddrag", (event) => {
				if (event.body?.label === "pubmon" && pubmonBodyRef.current) {
					const body = pubmonBodyRef.current;
					const velocity = body.velocity;
					const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);

					// Check if near pokeball (exit zone) - top right corner
					const pokeballX = canvas.width - POKEBALL_SIZE / 2 - 20;
					const pokeballY = POKEBALL_SIZE / 2 + 20;
					const dx = body.position.x - pokeballX;
					const dy = body.position.y - pokeballY;
					const distance = Math.sqrt(dx ** 2 + dy ** 2);

					if (distance < POKEBALL_RADIUS) {
						onExitRef.current();
						return;
					}

					// If thrown (fast release), go into free mode
					if (speed > 5) {
						updateState("free");
					} else {
						// Slow release, return to walking
						updateState("walking");
						(body as any).isKinematic = true;
						Matter.Body.setAngle(body, 0);
						Matter.Body.setVelocity(body, { x: 0, y: 0 });
						Matter.Body.setAngularVelocity(body, 0);
					}
				}
			});
		}

		// Accelerometer support for mobile (not in overlay mode)
		const handleOrientation = !overlay
			? (event: DeviceOrientationEvent) => {
					if (
						engineRef.current &&
						event.beta !== null &&
						event.gamma !== null
					) {
						// Beta: front-to-back tilt (-180 to 180)
						// Gamma: left-to-right tilt (-90 to 90)
						const gravityX = (event.gamma / 90) * 1;
						const gravityY = (event.beta / 90) * 1;

						engineRef.current.gravity.x = gravityX;
						engineRef.current.gravity.y = gravityY;
					}
				}
			: () => {};

		// Request permission for iOS devices
		if (!overlay) {
			if (
				typeof (DeviceOrientationEvent as any).requestPermission === "function"
			) {
				(DeviceOrientationEvent as any)
					.requestPermission()
					.then((permissionState: string) => {
						if (permissionState === "granted") {
							window.addEventListener("deviceorientation", handleOrientation);
						}
					})
					.catch(console.error);
			} else {
				window.addEventListener("deviceorientation", handleOrientation);
			}
		}

		// Shake detection for free mode (not in overlay mode)
		let lastAcceleration = { x: 0, y: 0, z: 0 };
		const handleMotion = !overlay
			? (event: DeviceMotionEvent) => {
					if (
						event.accelerationIncludingGravity &&
						pubmonBodyRef.current &&
						stateRef.current !== "grabbed"
					) {
						const { x = 0, y = 0, z = 0 } = event.accelerationIncludingGravity;
						const deltaX = Math.abs(x - lastAcceleration.x);
						const deltaY = Math.abs(y - lastAcceleration.y);
						const deltaZ = Math.abs(z - lastAcceleration.z);

						// Detect shake (sudden acceleration change)
						if (deltaX > 15 || deltaY > 15 || deltaZ > 15) {
							updateState("free");
							(pubmonBodyRef.current as any).isKinematic = false;
							Matter.Body.applyForce(
								pubmonBodyRef.current,
								pubmonBodyRef.current.position,
								{
									x: (Math.random() - 0.5) * 0.05,
									y: (Math.random() - 0.5) * 0.05,
								},
							);
						}

						lastAcceleration = { x, y, z };
					}
				}
			: () => {};

		if (!overlay) {
			window.addEventListener("devicemotion", handleMotion);
		}

		// Run the engine
		const runner = Matter.Runner.create();
		Matter.Runner.run(runner, engine);

		// Render loop
		const loadSprite = () => {
			const img = new Image();
			img.src = spritePath;
			return img;
		};

		const spriteImg = loadSprite();

		// Load pokeball sprites
		const pokeballImg = new Image();
		pokeballImg.src = "/sprites/POKEBALL.png";
		const pokeballOpenImg = new Image();
		pokeballOpenImg.src = "/sprites/POKEBALL_OPEN.png";

		// Track mouse position for pokeball hover detection
		const handleDocumentMouseMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			mousePositionRef.current = { x, y };

			const pkX = canvas.width - POKEBALL_SIZE / 2 - 20;
			const pkY = POKEBALL_SIZE / 2 + 20;
			isPokeballHoveredRef.current =
				Math.hypot(x - pkX, y - pkY) < POKEBALL_RADIUS;
		};

		document.addEventListener("mousemove", handleDocumentMouseMove);

		const render = () => {
			if (!canvasRef.current || !ctx) return;

			// Clear canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Background (only in non-overlay mode)
			if (!overlay) {
				ctx.fillStyle = "#87CEEB";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}

			ctx.restore();

			// Update hit-area div to track pubmon bounds
			const body = pubmonBodyRef.current;
			if (body && hitAreaRef.current) {
				const ha = hitAreaRef.current;
				if (stateRef.current === "grabbed") {
					// Full-screen during drag so cursor can't escape
					ha.style.left = "0px";
					ha.style.top = "0px";
					ha.style.width = "100vw";
					ha.style.height = "100vh";
				} else {
					const pad = 20;
					const b = body.bounds;
					ha.style.left = `${b.min.x - pad}px`;
					ha.style.top = `${b.min.y - pad}px`;
					ha.style.width = `${b.max.x - b.min.x + pad * 2}px`;
					ha.style.height = `${b.max.y - b.min.y + pad * 2}px`;
				}
			}

			// Draw PubMon
			if (body && spriteImg.complete) {
				// Add bobbing animation when walking (square wave, 2 pixels up/down)
				const bobOffset =
					stateRef.current === "walking"
						? Math.sign(Math.sin(frameRef.current * 0.02)) * 2 - 10
						: 0;

				ctx.save();
				ctx.translate(body.position.x, body.position.y + bobOffset);

				// Flip sprite based on direction (before rotation so flip is world-relative)
				const isFlipped = walkDirectionRef.current > 0;
				if (isFlipped) {
					ctx.scale(-1, 1);
				}

				// When flipped, negate the rotation so it rotates in the same direction as hitbox
				ctx.rotate(isFlipped ? -body.angle : body.angle);

				// Apply the secret medal shader if this mon came from a
				// placement pokeball (gold/silver/bronze).
				let spriteSource: HTMLImageElement | HTMLCanvasElement = spriteImg;
				if (medal) {
					if (medalGL?.ok) {
						spriteSource = medalGL.render(
							spriteImg,
							medal,
							performance.now() / 1000,
						);
					} else {
						if (!cpuShadeTried) {
							cpuShadeTried = true;
							try {
								cpuShaded = applyMedalShader(spriteImg, medal);
							} catch (err) {
								console.error("medal shader failed", err);
								cpuShaded = null;
							}
						}
						spriteSource = cpuShaded ?? spriteImg;
					}
				}

				// Draw sprite centered at the hitbox centroid, not image center
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(
					spriteSource,
					-spriteCentroidRef.current.x,
					-spriteCentroidRef.current.y,
					SPRITE_SIZE,
					SPRITE_SIZE,
				);

				ctx.restore();

				// Debug mode: draw hitbox (in world coordinates, outside transform)
				if (debugMode && body.vertices) {
					ctx.strokeStyle = "red";
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(body.vertices[0].x, body.vertices[0].y);
					for (let i = 1; i < body.vertices.length; i++) {
						ctx.lineTo(body.vertices[i].x, body.vertices[i].y);
					}
					ctx.closePath();
					ctx.stroke();
				}

				// Speech bubble logic
				if (speechTimerRef.current > 0) {
					speechTimerRef.current--;
				} else if (speechCooldownRef.current > 0) {
					speechCooldownRef.current--;
				} else {
					// Pick a new saying based on current state
					const sayings =
						stateRef.current === "grabbed"
							? GRABBED_SAYINGS
							: stateRef.current === "free"
								? FREE_SAYINGS
								: CUTE_SAYINGS;
					speechTextRef.current =
						sayings[Math.floor(Math.random() * sayings.length)];
					speechTimerRef.current = SPEECH_DISPLAY_TIME;
					speechCooldownRef.current =
						Math.floor(
							Math.random() * (SPEECH_COOLDOWN_MAX - SPEECH_COOLDOWN_MIN),
						) + SPEECH_COOLDOWN_MIN;
				}

				// Draw speech bubble when active
				if (speechTimerRef.current > 0 && speechTextRef.current) {
					const text = speechTextRef.current;
					const bubbleX = body.position.x;
					const bubbleY = body.position.y - SPRITE_SIZE / 2 - 16;

					ctx.save();
					ctx.font = "bold 14px monospace";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					const metrics = ctx.measureText(text);
					const padX = 10;
					const padY = 6;
					const bw = metrics.width + padX * 2;
					const bh = 20 + padY * 2;

					// Fade out in last 30 frames
					const alpha =
						speechTimerRef.current < 30 ? speechTimerRef.current / 30 : 1;
					ctx.globalAlpha = alpha;

					// Bubble background
					const bx = bubbleX - bw / 2;
					const by = bubbleY - bh;
					ctx.fillStyle = "#fff";
					ctx.strokeStyle = "#222";
					ctx.lineWidth = 2;

					// Rounded rect
					const r = 8;
					ctx.beginPath();
					ctx.moveTo(bx + r, by);
					ctx.lineTo(bx + bw - r, by);
					ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
					ctx.lineTo(bx + bw, by + bh - r);
					ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
					ctx.lineTo(bx + bw / 2 + 6, by + bh);
					// Speech tail
					ctx.lineTo(bubbleX, by + bh + 8);
					ctx.lineTo(bx + bw / 2 - 6, by + bh);
					ctx.lineTo(bx + r, by + bh);
					ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
					ctx.lineTo(bx, by + r);
					ctx.quadraticCurveTo(bx, by, bx + r, by);
					ctx.closePath();
					ctx.fill();
					ctx.stroke();

					// Text
					ctx.fillStyle = "#222";
					ctx.fillText(text, bubbleX, bubbleY - bh / 2);
					ctx.restore();
				}
			}

			// Draw pokeball in top right
			const pokeballX = canvas.width - POKEBALL_SIZE / 2 - 20;
			const pokeballY = POKEBALL_SIZE / 2 + 20;
			const currentPokeballImg = isPokeballHoveredRef.current
				? pokeballOpenImg
				: pokeballImg;

			if (currentPokeballImg.complete) {
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(
					currentPokeballImg,
					pokeballX - POKEBALL_SIZE / 2,
					pokeballY - POKEBALL_SIZE / 2,
					POKEBALL_SIZE,
					POKEBALL_SIZE,
				);
			}

			// Update walking behavior
			if (stateRef.current === "walking" && body) {
				// Apply gentle rotational force towards upright
				const targetAngle = 0;
				const angleDiff = targetAngle - body.angle;
				const torque = angleDiff * 0.0001; // Gentle corrective torque
				Matter.Body.setAngularVelocity(body, body.angularVelocity + torque);

				if ((body as any).isKinematic) {
					// Pace left and right
					const speed = 0.2;

					const targetY = body.position.y;

					// Check if out of bounds and reverse direction
					if (body.position.x < 100) {
						walkDirectionRef.current = 1; // Force right
						Matter.Body.setPosition(body, { x: 100, y: targetY });
					} else if (body.position.x > canvas.width - 100) {
						walkDirectionRef.current = -1; // Force left
						Matter.Body.setPosition(body, {
							x: canvas.width - 100,
							y: targetY,
						});
					}

					const newX = body.position.x + walkDirectionRef.current * speed;

					// Change direction at boundaries
					if (newX < 100 || newX > canvas.width - 100) {
						walkDirectionRef.current *= -1;
					}

					// Flip hitbox vertices when direction changes
					if (walkDirectionRef.current !== previousDirectionRef.current) {
						const vertices =
							walkDirectionRef.current > 0
								? hitboxVerticesRef.current.flipped
								: hitboxVerticesRef.current.normal;
						if (vertices.length > 0) {
							Matter.Body.setVertices(body, vertices as Matter.Vector[]);
						}
						previousDirectionRef.current = walkDirectionRef.current;
					}

					Matter.Body.setPosition(body, {
						x: body.position.x + walkDirectionRef.current * speed,
						y: targetY,
					});

					// Random jump (roughly once every 5-6 seconds at 60fps) - not in overlay mode
					if (!overlay && Math.random() < 0.0003) {
						Matter.Body.setVelocity(body, {
							x: walkDirectionRef.current * speed,
							y: -10,
						});
						(body as any).isKinematic = false;
						setTimeout(() => {
							if (stateRef.current === "walking" && pubmonBodyRef.current) {
								(pubmonBodyRef.current as any).isKinematic = true;
								Matter.Body.setVelocity(pubmonBodyRef.current, { x: 0, y: 0 });
							}
						}, 500);
					}
				}
			}

			// Check for recovery (free -> walking after resting)
			if (stateRef.current === "free" && body) {
				const velocity = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);

				if (velocity < VELOCITY_THRESHOLD) {
					restingTimerRef.current += 16; // Approximate frame time

					if (restingTimerRef.current >= RECOVERY_TIME) {
						// Auto-recover
						updateState("walking");
						(body as any).isKinematic = true;
						Matter.Body.setAngle(body, 0);
						Matter.Body.setVelocity(body, { x: 0, y: 0 });
						Matter.Body.setAngularVelocity(body, 0);
						restingTimerRef.current = 0;

						// Jump to signal recovery
						Matter.Body.applyForce(body, body.position, { x: 0, y: -0.05 });
					}
				} else {
					restingTimerRef.current = 0;
				}
			}

			// Play cry when grabbed and moved slowly
			if (stateRef.current === "grabbed" && body) {
				const dx = body.position.x - lastPositionRef.current.x;
				const dy = body.position.y - lastPositionRef.current.y;
				const distance = Math.sqrt(dx ** 2 + dy ** 2);

				if (distance > 5 && distance < 20) {
					// Slow movement
					if (frameRef.current % 60 === 0) {
						// Every ~1 second
						playPokemonCry(pubmon.id);
					}
				}

				lastPositionRef.current = { x: body.position.x, y: body.position.y };
			}

			frameRef.current++;

			requestAnimationFrame(render);
		};

		spriteImg.onload = () => {
			render();
		};

		// Start rendering immediately if image is cached
		if (spriteImg.complete) {
			render();
		}

		// Window resize handler
		const handleResize = () => {
			if (!canvasRef.current) return;
			canvasRef.current.width = window.innerWidth;
			canvasRef.current.height = window.innerHeight;

			// Update walls (only in non-overlay mode)
			if (!overlay) {
				const world = engineRef.current?.world;
				if (world) {
					const bodiesToRemove = Matter.Composite.allBodies(world).filter(
						(b) =>
							b.label.includes("wall") ||
							b.label === "floor" ||
							b.label === "ceiling",
					);
					Matter.World.remove(world, bodiesToRemove);

					const newWalls = [
						Matter.Bodies.rectangle(
							canvas.width / 2,
							canvas.height + wallThickness / 2,
							canvas.width,
							wallThickness,
							{ isStatic: true, label: "floor" },
						),
						Matter.Bodies.rectangle(
							canvas.width / 2,
							-wallThickness / 2,
							canvas.width,
							wallThickness,
							{ isStatic: true, label: "ceiling" },
						),
						Matter.Bodies.rectangle(
							-wallThickness / 2,
							canvas.height / 2,
							wallThickness,
							canvas.height,
							{ isStatic: true, label: "wall-left" },
						),
						Matter.Bodies.rectangle(
							canvas.width + wallThickness / 2,
							canvas.height / 2,
							wallThickness,
							canvas.height,
							{ isStatic: true, label: "wall-right" },
						),
					];

					Matter.World.add(world, newWalls);
				}
			}
		};

		window.addEventListener("resize", handleResize);

		// Cleanup
		return () => {
			Matter.Runner.stop(runner);
			Matter.World.clear(engine.world, false);
			Matter.Engine.clear(engine);
			document.removeEventListener("mousemove", handleDocumentMouseMove);
			if (hitArea) {
				hitArea.removeEventListener("mousedown", forwardMouse);
				hitArea.removeEventListener("mousemove", forwardMouse);
				hitArea.removeEventListener("mouseup", forwardMouse);
				hitArea.removeEventListener("touchstart", forwardTouch);
				hitArea.removeEventListener("touchmove", forwardTouch);
				hitArea.removeEventListener("touchend", forwardTouch);
			}
			window.removeEventListener("deviceorientation", handleOrientation);
			window.removeEventListener("devicemotion", handleMotion);
			window.removeEventListener("resize", handleResize);
			medalGL?.dispose();
		};
	}, [pubmon, debugMode, overlay, medal]);

	return (
		<>
			{/* White flash on deploy only */}
			<motion.div
				initial={{ opacity: 1 }}
				animate={{ opacity: [1, 1, 0] }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.5, times: [0, 0.4, 1] }}
				style={{
					position: "fixed",
					inset: 0,
					backgroundColor: "#fff",
					pointerEvents: "none",
					zIndex: 10000,
				}}
			/>
			<motion.div
				initial={{ scale: 0, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				exit={{ scale: 0, opacity: 0 }}
				transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					width: "100vw",
					height: "100vh",
					zIndex: 9999,
					backgroundColor: overlay ? "transparent" : "#000",
					pointerEvents: "none",
					transformOrigin: "calc(100% - 44px) 44px",
				}}
			>
				<canvas
					ref={canvasRef}
					style={{
						display: "block",
						pointerEvents: "none",
					}}
				/>
				{/* Interactive hit area that tracks the pubmon body */}
				<div
					ref={hitAreaRef}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						pointerEvents: "auto",
						cursor: "grab",
					}}
				/>
				{/* Pokeball click area */}
				<div
					style={{
						position: "absolute",
						top: 20,
						right: 20,
						width: POKEBALL_SIZE,
						height: POKEBALL_SIZE,
						pointerEvents: "auto",
						cursor: "pointer",
					}}
					onClick={onExit}
				/>
			</motion.div>
		</>
	);
}
