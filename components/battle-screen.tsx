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
	onCatch: () => void; // Called when catch succeeds in sim
	onRun: () => void; // Called when run succeeds in sim
	onBattleEnd?: (result: "win" | "loss") => void; // Called when pokemon faints
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
		playerAttacking,
		enemyAttacking,
		handleAttack,
		playerActivePokemon,
		enemyActivePokemon,
		battleEnded,
		battleResult,
		continueMessage,
		forfeitTurn,
		protocolRequest,
	} = useBattle({
		wildPokemon,
		playerPokemon,
		engine,
		onCatchSuccess: onCatch,
		onRunSuccess: onRun,
	});

	console.log(playerActivePokemon);

	const { playBGM, playCry, preloadCry } = useAudio();

	const [slideFrame, setSlideFrame] = useState(0);
	const [showMenu, setShowMenu] = useState(false);
	const [selectedMove, setSelectedMove] = useState(0);
	const [showCatchAnim, setShowCatchAnim] = useState(false);

	const wildType = TYPE_INFO[wildPokemon.type];

	// Pre-load Pokemon cries when battle starts
	useEffect(() => {
		preloadCry(wildPokemon.cry);
		if (playerPokemon) {
			preloadCry(playerPokemon.cry);
		}
	}, [wildPokemon.cry, playerPokemon, preloadCry]);

	// Reset catch animation when enemy attacks (catch failed) or battle ends
	useEffect(() => {
		if (enemyAttacking || battleEnded) {
			setShowCatchAnim(false);
		}
	}, [enemyAttacking, battleEnded]);

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
		if (isAnimating || !protocolRequest?.active?.[0]?.moves) return;

		// Find the "run" move index
		const runMoveIndex = protocolRequest.active[0].moves.findIndex(
			(move) => move.id === "run"
		);

		if (runMoveIndex === -1) {
			console.error("Run move not found!");
			return;
		}

		// Use the battle engine's run move
		handleAttack(runMoveIndex);
	}, [isAnimating, protocolRequest, handleAttack]);

	const handleCatch = useCallback(() => {
		if (isAnimating || !protocolRequest?.active?.[0]?.moves) return;

		// Find the "catch" move index
		const catchMoveIndex = protocolRequest.active[0].moves.findIndex(
			(move) => move.id === "catch"
		);

		if (catchMoveIndex === -1) {
			console.error("Catch move not found!");
			return;
		}

		// Use the battle engine's catch move
		setShowCatchAnim(true);
		handleAttack(catchMoveIndex);
	}, [isAnimating, protocolRequest, handleAttack]);

	// Calculate pixel offsets (snap to grid of 2px)
	const progress = Math.min(slideFrame / SLIDE_FRAMES, 1);
	const eased = 1 - (1 - progress) ** 2;
	const playerOffset = Math.round(((1 - eased) * 320) / 2) * 2;
	const enemyOffset = Math.round(((1 - eased) * 320) / 2) * 2;

	console.log("PROTOCOL", protocolRequest?.active);

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
						transform: `translateX(-${enemyOffset}px) ${
							enemyAttacking
								? "translate(calc(-25% - 20px), calc(25% + 20px))"
								: ""
						}`,
						transition: enemyAttacking ? "transform 0.15s ease-out" : "none",
						animation: enemyShake ? "pixel-shake 0.3s ease-in-out" : undefined,
					}}
				>
					{showCatchAnim ? (
						<img
							src="/sprites/POKEBALL.png"
							alt="Pokeball"
							width={60}
							height={60}
							style={{
								imageRendering: "pixelated",
								animation: "pokeball-shake 0.6s steps(3, end) infinite",
							}}
						/>
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
								transform: `translateX(${playerOffset}px) ${
									playerAttacking
										? "translate(calc(25% + 20px), calc(-25% - 20px))"
										: ""
								}`,
								transition: playerAttacking
									? "transform 0.15s ease-out"
									: "none",
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
					<div>
						<PixelBox
							className="mb-[2px]"
							style={{
								background:
									"linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)",
								boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
							}}
						>
							<div className="py-2 px-3 text-center">
								<p className="font-pixel text-gba-[9] text-pixel-black">
									What will{" "}
									{playerPokemon ? (
										<span
											className="font-bold"
											style={{ color: TYPE_INFO[playerPokemon.type].color }}
										>
											{playerPokemon.name.toUpperCase()}
										</span>
									) : (
										<span className="font-bold text-pixel-black/70">YOU</span>
									)}{" "}
									do?
								</p>
							</div>
						</PixelBox>
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
					</div>
				)}

				{/* Fight submenu - move selection */}
				{menu === "fight" &&
					!message &&
					playerPokemon &&
					protocolRequest?.active?.[0]?.moves && (
						<div>
							<PixelBox
								className="mb-[2px]"
								style={{
									background:
										"linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)",
									boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
								}}
							>
								<div className="py-2 px-3 text-center">
									<p className="font-pixel text-gba-[9] text-pixel-black">
										What will{" "}
										<span
											className="font-bold"
											style={{ color: TYPE_INFO[playerPokemon.type].color }}
										>
											{playerPokemon.name.toUpperCase()}
										</span>{" "}
										do?
									</p>
								</div>
							</PixelBox>
							<div className="grid grid-cols-2 gap-[2px] mb-[2px]">
								{protocolRequest.active[0].moves
									.map((move, originalIdx) => ({ move, originalIdx }))
									.filter(({ move }) => move.id !== "run" && move.id !== "catch")
									.map(({ move, originalIdx }) => {
										const isDisabled = move.disabled || move.pp <= 0;
										return (
											<button
												type="button"
												key={move.id}
												onClick={() => {
													if (!isDisabled) {
														setSelectedMove(originalIdx);
														handleAttack(originalIdx);
													}
												}}
												disabled={isDisabled}
												className={`pixel-box cursor-pointer font-pixel text-gba-[9] text-center py-[4px] border-none ${
													isDisabled
														? "bg-pixel-gray-light opacity-50 cursor-not-allowed"
														: originalIdx === selectedMove
															? "bg-pixel-gray-light"
															: "bg-pixel-white hover:bg-pixel-gray-light"
												}`}
											>
												<div className="flex flex-col items-center text-black">
													<span>{move.move.toUpperCase()}</span>
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
						<PixelBox
							className="mb-[2px]"
							style={{
								background:
									"linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)",
								boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
							}}
						>
							<div className="py-2 px-3 text-center">
								<p className="font-pixel text-gba-[9] text-pixel-black">
									What will{" "}
									<span className="font-bold text-pixel-black/70">YOU</span> do?
								</p>
							</div>
						</PixelBox>
						<div className="mb-[2px]">
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

			{/* Battle End Overlay - only for win/loss */}
			{battleEnded && battleResult && (
				<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
					<div className="w-full max-w-sm mx-4">
						<PixelBox className="bg-pixel-white">
							<div className="flex flex-col items-center gap-4 py-6">
								<h2 className="font-pixel text-gba-[9] font-palette-default">
									{battleResult === "win" ? "VICTORY!" : "DEFEATED..."}
								</h2>
								<p className="font-pixel text-gba-[9] font-palette-muted text-center">
									{battleResult === "win"
										? `You defeated the wild ${wildPokemon.name}!`
										: `You were defeated by the wild ${wildPokemon.name}!`}
								</p>
								<button
									onClick={() => onBattleEnd?.(battleResult)}
									className="pixel-box cursor-pointer font-pixel text-gba-[9] font-palette-blue text-center px-8 py-3 border-none bg-primary hover:brightness-110"
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
