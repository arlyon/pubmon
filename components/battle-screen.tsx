"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useBattle } from "@/hooks/use-battle";
import { type PubMon, TYPE_INFO } from "@/lib/pokemon-data";
import { useAudio } from "./audio-manager";
import PixelBox from "./pixel/PixelBox";
import PixelStatCard from "./pixel/PixelStatCard";
import PixelTextBox from "./pixel/PixelTextBox";
import { PixelSprite } from "./pixel-sprite";

interface BattleScreenProps {
	wildPokemon: PubMon;
	playerPokemon: PubMon | null;
	onFight: () => void;
	onCatch: () => void;
	onRun: () => void;
	onBattleEnd?: (result: "win" | "loss") => void;
	battleMode?: "wild" | "p2p"; // Optional: defaults to 'wild'
	battleId?: string; // Required if battleMode === 'p2p'
	socket?: any; // PartySocket for P2P battles
	sessionId?: string; // Required if battleMode === 'p2p'
}

const SLIDE_FRAMES = 80;
const FRAME_MS = 16;

export function BattleScreen({
	wildPokemon,
	playerPokemon,
	onFight,
	onCatch,
	onRun,
	onBattleEnd,
	battleMode = "wild",
	battleId,
	socket,
	sessionId,
}: BattleScreenProps) {
	// Create appropriate engine for battle mode
	const engine = React.useMemo(() => {
		if (battleMode === "p2p" && battleId && socket && sessionId) {
			// Dynamic import to avoid issues
			const { RemoteBattleEngine } = require("@/lib/battle-engine");
			return new RemoteBattleEngine(battleId, sessionId, socket);
		}
		return undefined; // Let useBattle create LocalBattleEngine
	}, [battleMode, battleId, socket, sessionId]);

	const {
		menu,
		setMenu,
		message,
		setMessage,
		enemyHp,
		playerHp,
		isAnimating,
		setIsAnimating,
		playerShake,
		enemyShake,
		handleAttack,
		playerActivePokemon,
		enemyActivePokemon,
		battleEnded,
		battleResult,
		continueMessage,
	} = useBattle({ wildPokemon, playerPokemon, engine });
	const { playBGM, playCry, preloadCry } = useAudio();

	const [showCatchAnim, setShowCatchAnim] = useState(false);
	const [slideFrame, setSlideFrame] = useState(0);
	const [showMenu, setShowMenu] = useState(false);
	const [selectedMove, setSelectedMove] = useState(0);

	const wildType = TYPE_INFO[wildPokemon.type];

	// Pre-load Pokemon cries when battle starts
	useEffect(() => {
		preloadCry(wildPokemon.cry);
		if (playerPokemon) {
			preloadCry(playerPokemon.cry);
		}
	}, [wildPokemon.cry, playerPokemon, preloadCry]);

	// Play victory music when battle is won
	useEffect(() => {
		if (battleEnded && battleResult === "win") {
			playBGM("victory");
		}
	}, [battleEnded, battleResult, playBGM]);

	// Frame-based slide-in animation for battle start
	useEffect(() => {
		let frame = 0;
		let lastTime = performance.now();
		let animationId: number;

		const animate = (currentTime: number) => {
			const elapsed = currentTime - lastTime;

			if (elapsed >= FRAME_MS) {
				frame++;
				setSlideFrame(frame);
				lastTime = currentTime;

				if (frame >= SLIDE_FRAMES) {
					// Play enemy cry when animation completes
					playCry(wildPokemon.cry);

					setTimeout(() => setShowMenu(true), 200);
					return;
				}
			}

			animationId = requestAnimationFrame(animate);
		};

		animationId = requestAnimationFrame(animate);

		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	}, [wildPokemon.cry]);

	const handleBag = useCallback(() => {
		if (isAnimating) return;
		setIsAnimating(true);
		setMenu("message");
		setMessage("Not implemented yet!");
		setTimeout(() => {
			setIsAnimating(false);
			setMenu("main");
			setMessage(null);
		}, 1500);
	}, [isAnimating, setIsAnimating, setMenu, setMessage]);

	const handleRun = useCallback(() => {
		if (isAnimating || !playerActivePokemon || !enemyActivePokemon) return;

		setIsAnimating(true);
		setMenu("message");

		// Calculate effective speed including boosts
		const playerSpeed = playerActivePokemon.boosts.spe;
		const enemySpeed = enemyActivePokemon.boosts.spe;

		// Higher speed guarantees escape, otherwise RNG roll
		let escapeChance = 0.5; // Base 50% chance
		if (playerSpeed > enemySpeed) {
			escapeChance = 1.0; // Guaranteed escape if faster
		} else if (playerSpeed < enemySpeed) {
			escapeChance = 0.25; // Lower chance if slower
		}

		const escaped = Math.random() < escapeChance;

		if (escaped) {
			setMessage("Got away safely!");
			setTimeout(() => onRun(), 1500);
		} else {
			setMessage("Can't escape!");
			setTimeout(() => {
				setIsAnimating(false);
				setMenu("main");
				setMessage(null);
			}, 1500);
		}
	}, [
		isAnimating,
		playerActivePokemon,
		enemyActivePokemon,
		onRun,
		setIsAnimating,
		setMenu,
		setMessage,
	]);

	const handleCatch = useCallback(() => {
		if (isAnimating) return;
		setIsAnimating(true);
		setMenu("message");
		setShowCatchAnim(true);
		setMessage("You threw a PubBall!");

		// Play ball toss sound effect
		const ballTossAudio = new Audio("/audio/general/SFX_BALL_TOSS.wav");
		ballTossAudio.play().catch(() => {
			// Silently fail if audio can't play
		});

		setTimeout(() => {
			// Calculate catch rate based on enemy's weakened HP and status
			let catchRate = 0.3; // Base catch rate

			if (enemyActivePokemon) {
				// HP factor: Lower HP = higher catch rate (up to 3x multiplier)
				const hpRatio = enemyActivePokemon.hp / enemyActivePokemon.maxhp;
				const hpMultiplier = Math.max(1, (1 - hpRatio) * 2 + 1); // 1x at full HP, up to 3x at low HP

				// Status multiplier
				let statusMultiplier = 1;
				if (
					enemyActivePokemon.status === "slp" ||
					enemyActivePokemon.status === "frz"
				) {
					statusMultiplier = 2; // Sleep and Freeze give 2x multiplier
				} else if (enemyActivePokemon.status) {
					statusMultiplier = 1.5; // Other status conditions give 1.5x multiplier
				}

				catchRate = catchRate * hpMultiplier * statusMultiplier;
			}

			const caught = Math.random() < catchRate;
			setShowCatchAnim(false);
			if (caught) {
				// Play caught sound effect
				const caughtAudio = new Audio("/audio/general/SFX_CAUGHT_MON.wav");
				caughtAudio.play().catch(() => {
					// Silently fail if audio can't play
				});

				setMessage(`Gotcha! ${wildPokemon.name} was caught!`);
				setTimeout(() => onCatch(), 2000);
			} else {
				setMessage(`Oh no! ${wildPokemon.name} broke free!`);
				setTimeout(() => {
					setIsAnimating(false);
					setMenu("main");
					setMessage(null);
				}, 1500);
			}
		}, 2000);
	}, [
		wildPokemon,
		isAnimating,
		onCatch,
		setIsAnimating,
		setMenu,
		setMessage,
		enemyActivePokemon,
	]);

	// Calculate pixel offsets (snap to grid of 2px)
	const progress = Math.min(slideFrame / SLIDE_FRAMES, 1);
	const eased = 1 - (1 - progress) ** 2;
	const playerOffset = Math.round(((1 - eased) * 320) / 2) * 2;
	const enemyOffset = Math.round(((1 - eased) * 320) / 2) * 2;

	return (
		<div
			className="w-full max-w-md mx-auto flex flex-col"
			style={{ background: wildType.bgColor }}
		>
			{/* Battle arena */}
			<div className="relative aspect-[4/3] overflow-hidden">
				{/* Background */}
				<div
					className="absolute inset-0"
					style={{
						background: `linear-gradient(180deg, #1a1c2c 0%, ${wildType.bgColor} 40%, ${wildType.color}22 100%)`,
					}}
				/>

				{/* Ground plane */}
				<div className="absolute bottom-0 left-0 right-0 h-[40%]">
					<svg
						viewBox="0 0 100 40"
						className="w-full h-full"
						preserveAspectRatio="none"
						style={{ imageRendering: "pixelated" }}
					>
						{/* Ground tiles */}
						{Array.from({ length: 20 }).map((_, row) =>
							Array.from({ length: 25 }).map((_, col) => (
								<rect
									key={`${row}-${col}`}
									x={col * 4}
									y={row * 2}
									width={4}
									height={2}
									fill={
										(row + col) % 2 === 0
											? `${wildType.color}15`
											: `${wildType.color}08`
									}
									stroke={`${wildType.color}10`}
									strokeWidth={0.2}
								/>
							)),
						)}
					</svg>
				</div>

				{/* Enemy pokemon - top left with slide-in */}
				<div
					className="absolute top-2 left-2 flex flex-col items-end gap-2 z-10"
					style={{
						transform: `translateX(-${enemyOffset}px)`,
						transition: "none",
					}}
				>
					{slideFrame >= SLIDE_FRAMES && (
						<PixelStatCard
							pokemon={wildPokemon}
							currentHp={enemyHp}
							maxHp={enemyActivePokemon?.maxhp}
							status={enemyActivePokemon?.status}
							showHpNumbers={false}
						/>
					)}
				</div>

				{/* Wild pokemon sprite */}
				<div
					className="absolute top-6 right-12 z-10"
					style={{
						transform: `translateX(-${enemyOffset}px)`,
						transition: "none",
						animation: enemyShake ? "pixel-shake 0.3s ease-in-out" : undefined,
					}}
				>
					{showCatchAnim ? (
						<div
							style={{ animation: "pokeball-shake 0.5s ease-in-out infinite" }}
						>
							<svg
								viewBox="0 0 10 10"
								width={60}
								height={60}
								style={{ imageRendering: "pixelated" }}
							>
								<circle cx={5} cy={5} r={4.5} fill="#e43b44" />
								<rect x={0.5} y={4.5} width={9} height={1} fill="#1a1c2c" />
								<circle
									cx={5}
									cy={5}
									r={4.5}
									fill="none"
									stroke="#1a1c2c"
									strokeWidth={0.5}
								/>
								<rect
									x={0.5}
									y={5}
									width={9}
									height={4.5}
									rx={4.5}
									fill="#f4f4f4"
								/>
								<circle
									cx={5}
									cy={5}
									r={1.2}
									fill="#f4f4f4"
									stroke="#1a1c2c"
									strokeWidth={0.4}
								/>
								<circle cx={5} cy={5} r={0.6} fill="#1a1c2c" />
							</svg>
						</div>
					) : (
						<PixelSprite
							name={wildPokemon.sprite}
							size={80}
							animated
							variant={wildPokemon.spriteVariant}
						/>
					)}
				</div>

				{/* Player pokemon - bottom left with slide-in */}
				{playerPokemon && (
					<>
						<div
							className="absolute bottom-2 right-2 flex flex-col items-start gap-2 z-10"
							style={{
								transform: `translateX(-${playerOffset}px)`,
								transition: "none",
							}}
						>
							{slideFrame >= SLIDE_FRAMES && (
								<PixelStatCard
									pokemon={playerPokemon}
									currentHp={playerHp}
									maxHp={playerActivePokemon?.maxhp}
									status={playerActivePokemon?.status}
									showHpLabel
								/>
							)}
						</div>

						<div
							className="absolute bottom-0 left-6 z-10"
							style={{
								transform: `translateX(${playerOffset}px)`,
								transition: "none",
								animation: playerShake
									? "pixel-shake 0.3s ease-in-out"
									: undefined,
							}}
						>
							<PixelSprite
								name={playerPokemon.sprite}
								size={128}
								flipped
								animated
								variant={playerPokemon.spriteVariant}
							/>
						</div>
					</>
				)}
			</div>

			{/* Bottom UI panel */}
			<div className="p-2">
				{/* Message display */}
				{message && (
					<button
						onClick={continueMessage}
						className="w-full mb-2 text-left cursor-pointer border-none bg-transparent p-0 flex flex-col focus:outline-none"
					>
						<PixelTextBox text={message || ""} showContinue={true} rows={2} />
					</button>
				)}

				{/* Main menu */}
				{showMenu && menu === "main" && !message && (
					<div className="grid grid-cols-2 gap-[2px]">
						<button
							onClick={() => setMenu("fight")}
							disabled={!playerPokemon}
							className="pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light disabled:opacity-50"
						>
							FIGHT
						</button>
						<button
							onClick={handleCatch}
							className="pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
						>
							CATCH
						</button>
						<button
							onClick={handleBag}
							className="pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
						>
							BAG
						</button>
						<button
							onClick={handleRun}
							className="pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
						>
							RUN
						</button>
					</div>
				)}

				{/* Fight submenu - move selection */}
				{menu === "fight" &&
					!message &&
					playerPokemon &&
					playerActivePokemon && (
						<div>
							<div className="grid grid-cols-2 gap-[2px] mb-[2px]">
								{playerActivePokemon.moves.map((move, idx) => {
									return (
										<button
											type="button"
											key={move.name}
											onClick={() => {
												if (!move.disabled && move.pp > 0) {
													setSelectedMove(idx);
													handleAttack(idx);
												}
											}}
											disabled={move.disabled || move.pp <= 0}
											className={`pixel-box cursor-pointer font-pixel text-gba-[9] text-center py-[4px] border-none ${
												move.disabled || move.pp <= 0
													? "bg-pixel-gray-light opacity-50 cursor-not-allowed"
													: idx === selectedMove
														? "bg-pixel-gray-light"
														: "bg-pixel-white hover:bg-pixel-gray-light"
											}`}
										>
											<div className="flex flex-col items-center text-black">
												<span>{move.name.toUpperCase()}</span>
												<span className="text-gba-[9] text-pixel-black/70">
													PP: {move.pp}/{move.maxpp}
												</span>
											</div>
										</button>
									);
								})}
							</div>
							<button
								onClick={() => setMenu("main")}
								className="w-full pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center py-[4px] border-none bg-pixel-white hover:bg-pixel-gray-light"
							>
								BACK
							</button>
						</div>
					)}

				{/* No player pokemon message */}
				{showMenu && !playerPokemon && menu === "main" && !message && (
					<div>
						<div>
							<PixelTextBox
								text={`You have no PubMon! Try to catch this wild ${wildPokemon.name.toUpperCase()}!`}
								showContinue={false}
								rows={2}
							/>
						</div>
						<div className="grid grid-cols-2 gap-[2px]">
							<button
								onClick={handleCatch}
								className="pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
							>
								CATCH
							</button>
							<button
								onClick={handleRun}
								className="pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
							>
								RUN
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Battle End Overlay */}
			{battleEnded && battleResult && (
				<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
					<div className="w-full max-w-sm mx-4">
						<PixelBox className="bg-pixel-white">
							<div className="flex flex-col items-center gap-4 py-6">
								<h2 className="font-pixel text-gba-[9] text-pixel-black">
									{battleResult === "win" ? "VICTORY!" : "DEFEATED..."}
								</h2>
								<p className="font-pixel text-gba-[9] text-pixel-black/70 text-center">
									{battleResult === "win"
										? `You defeated the wild ${wildPokemon.name}!`
										: `You were defeated by the wild ${wildPokemon.name}!`}
								</p>
								<button
									onClick={() => onBattleEnd?.(battleResult)}
									className="pixel-box cursor-pointer font-pixel text-gba-[9] text-pixel-black text-center px-8 py-3 border-none bg-primary hover:brightness-110"
								>
									CONTINUE
								</button>
							</div>
						</PixelBox>
					</div>
				</div>
			)}
		</div>
	);
}
