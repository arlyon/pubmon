"use client";

import Matter from "matter-js";
import { useEffect, useRef, useState } from "react";
import { usePokemonCry } from "@/hooks/use-pokemon-cry";
import { getSpriteHitbox, type Point, scaleHitbox } from "@/lib/physics-utils";
import { getPubMonSprite, type PubMon } from "@/lib/pokemon-data";

interface PlayCanvasProps {
	pubmon: PubMon;
	onExit: () => void;
	overlay?: boolean; // When true, renders as transparent click-through overlay
}

type PubMonState = "walking" | "grabbed" | "free";

const SPRITE_SIZE = 192; // Display size of the PubMon
const POKEBALL_SIZE = 96;
const POKEBALL_RADIUS = 48;
const RECOVERY_TIME = 2000; // ms to wait before auto-recovery
const VELOCITY_THRESHOLD = 0.5; // Velocity below which PubMon is considered "resting"

export function PlayCanvas({ pubmon, onExit, overlay = false }: PlayCanvasProps) {
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
		engine.gravity.y = overlay ? 0 : 1; // No gravity in overlay mode
		engineRef.current = engine;

		// Create boundaries (walls) - skip in overlay mode
		const wallThickness = 50;
		if (!overlay) {
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
		}

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

		// Create mouse constraint for dragging (not in overlay mode)
		if (!overlay) {
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

		// Mouse events for interaction (not in overlay mode)
		if (!overlay && mouseConstraintRef.current) {
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
		}

		// Accelerometer support for mobile (not in overlay mode)
		const handleOrientation = !overlay ? (event: DeviceOrientationEvent) => {
			if (engineRef.current && event.beta !== null && event.gamma !== null) {
				// Beta: front-to-back tilt (-180 to 180)
				// Gamma: left-to-right tilt (-90 to 90)
				const gravityX = (event.gamma / 90) * 1;
				const gravityY = (event.beta / 90) * 1;

				engineRef.current.gravity.x = gravityX;
				engineRef.current.gravity.y = gravityY;
			}
		} : () => {};

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
		const handleMotion = !overlay ? (event: DeviceMotionEvent) => {
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
		} : () => {};

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

		// Mouse move tracking for pokeball hover
		const handleMouseMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			mousePositionRef.current = { x: mouseX, y: mouseY };

			// Check if hovering over pokeball (top right)
			const pokeballX = canvas.width - POKEBALL_SIZE / 2 - 20;
			const pokeballY = POKEBALL_SIZE / 2 + 20;
			const dx = mouseX - pokeballX;
			const dy = mouseY - pokeballY;
			const distance = Math.sqrt(dx ** 2 + dy ** 2);

			isPokeballHoveredRef.current = distance < POKEBALL_RADIUS;
		};

		canvas.addEventListener("mousemove", handleMouseMove);

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

			// Draw PubMon
			const body = pubmonBodyRef.current;
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

				// Draw state bubble (not in overlay mode)
				if (!overlay) {
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

					// In overlay mode, walk at bottom of screen
					const targetY = overlay ? canvas.height - 100 : body.position.y;

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

			// Check for recovery (free -> walking after resting) - not in overlay mode
			if (!overlay && stateRef.current === "free" && body) {
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

			// Play cry when grabbed and moved slowly (not in overlay mode)
			if (!overlay && stateRef.current === "grabbed" && body) {
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
			canvas.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("deviceorientation", handleOrientation);
			window.removeEventListener("devicemotion", handleMotion);
			window.removeEventListener("resize", handleResize);
		};
	}, [pubmon, onExit, debugMode, overlay]);

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				zIndex: 9999,
				backgroundColor: overlay ? "transparent" : "#000",
				pointerEvents: overlay ? "none" : "auto",
			}}
		>
			<canvas
				ref={canvasRef}
				style={{
					display: "block",
					pointerEvents: overlay ? "none" : "auto",
				}}
			/>
			{/* Pokeball click area - always interactive */}
			{overlay && (
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
			)}
		</div>
	);
}
