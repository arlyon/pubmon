"use client";

import Matter from "matter-js";
import { useEffect, useRef, useState } from "react";
import { usePokemonCry } from "@/hooks/use-pokemon-cry";
import { getSpriteHitbox, type Point, scaleHitbox } from "@/lib/physics-utils";
import { getPubMonSprite, type PubMon } from "@/lib/pokemon-data";

interface PlayCanvasProps {
	pubmon: PubMon;
	onExit: () => void;
}

type PubMonState = "walking" | "grabbed" | "free";

const SPRITE_SIZE = 96; // Display size of the PubMon
const POKEBALL_RADIUS = 48;
const RECOVERY_TIME = 2000; // ms to wait before auto-recovery
const VELOCITY_THRESHOLD = 0.5; // Velocity below which PubMon is considered "resting"

export function PlayCanvas({ pubmon, onExit }: PlayCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
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
	const restingTimerRef = useRef<number>(0);
	const walkDirectionRef = useRef<number>(1);
	const lastPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	const frameRef = useRef<number>(0);
	const spriteCentroidRef = useRef<{ x: number; y: number }>({
		x: SPRITE_SIZE / 2,
		y: SPRITE_SIZE / 2,
	});
	const { playPokemonCry } = usePokemonCry([pubmon]);

	const updateState = (newState: PubMonState) => {
		setState(newState);
		stateRef.current = newState;
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

				// Create PubMon body
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

		// Create mouse constraint for dragging
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

		// Mouse events for interaction
		Matter.Events.on(mouseConstraint, "startdrag", (event) => {
			if (event.body?.label === "pubmon") {
				updateState("grabbed");
				(pubmonBodyRef.current as any).isKinematic = false;
				Matter.Body.setStatic(pubmonBodyRef.current!, false);
			}
		});

		Matter.Events.on(mouseConstraint, "enddrag", (event) => {
			if (event.body?.label === "pubmon" && pubmonBodyRef.current) {
				const body = pubmonBodyRef.current;
				const velocity = body.velocity;
				const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);

				// Check if near pokeball (exit zone)
				const pokeballX = canvas.width / 2;
				const pokeballY = canvas.height - POKEBALL_RADIUS - 20;
				const dx = body.position.x - pokeballX;
				const dy = body.position.y - pokeballY;
				const distance = Math.sqrt(dx ** 2 + dy ** 2);

				if (distance < POKEBALL_RADIUS) {
					onExit();
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

		// Accelerometer support for mobile
		const handleOrientation = (event: DeviceOrientationEvent) => {
			if (engineRef.current && event.beta !== null && event.gamma !== null) {
				// Beta: front-to-back tilt (-180 to 180)
				// Gamma: left-to-right tilt (-90 to 90)
				const gravityX = (event.gamma / 90) * 1;
				const gravityY = (event.beta / 90) * 1;

				engineRef.current.gravity.x = gravityX;
				engineRef.current.gravity.y = gravityY;
			}
		};

		// Request permission for iOS devices
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

		// Shake detection for free mode
		let lastAcceleration = { x: 0, y: 0, z: 0 };
		const handleMotion = (event: DeviceMotionEvent) => {
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
		};

		window.addEventListener("devicemotion", handleMotion);

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

		const render = () => {
			if (!canvasRef.current || !ctx) return;

			// Clear canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Background
			ctx.fillStyle = "#87CEEB";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			ctx.restore();

			// Draw PubMon
			const body = pubmonBodyRef.current;
			if (body && spriteImg.complete) {
				ctx.save();
				ctx.translate(body.position.x, body.position.y);

				// Flip sprite when walking right (before rotation so flip is world-relative)
				if (stateRef.current === "walking" && walkDirectionRef.current > 0) {
					ctx.scale(-1, 1);
				}

				ctx.rotate(body.angle);

				// Draw sprite centered at the hitbox centroid, not image center
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(
					spriteImg,
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

				// Draw state bubble
				const bubble =
					stateRef.current === "walking"
						? "😊"
						: stateRef.current === "grabbed"
							? "❤️"
							: "😵";
				ctx.font = "24px Arial";
				ctx.textAlign = "center";
				ctx.fillText(
					bubble,
					body.position.x,
					body.position.y - SPRITE_SIZE / 2 - 20,
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
					const newX = body.position.x + walkDirectionRef.current * speed;

					// Change direction at boundaries
					if (newX < 100 || newX > canvas.width - 100) {
						walkDirectionRef.current *= -1;
					}

					Matter.Body.setPosition(body, {
						x: body.position.x + walkDirectionRef.current * speed,
						y: body.position.y,
					});

					// Random jump (roughly once every 5-6 seconds at 60fps)
					if (Math.random() < 0.0003) {
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

			// Update walls
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
		};

		window.addEventListener("resize", handleResize);

		// Cleanup
		return () => {
			Matter.Runner.stop(runner);
			Matter.World.clear(engine.world, false);
			Matter.Engine.clear(engine);
			window.removeEventListener("deviceorientation", handleOrientation);
			window.removeEventListener("devicemotion", handleMotion);
			window.removeEventListener("resize", handleResize);
		};
	}, [pubmon, onExit, debugMode]);

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				zIndex: 9999,
				backgroundColor: "#000",
			}}
		>
			<canvas ref={canvasRef} style={{ display: "block" }} />
		</div>
	);
}
