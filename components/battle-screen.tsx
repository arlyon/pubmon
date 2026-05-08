"use client";

import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useBattle } from "@/hooks/use-battle";
import { type PubMon, TYPE_INFO } from "@/lib/pokemon-data";
import { cn } from "@/lib/utils";
import { useAudio } from "./audio-manager";
import { pickBattleScene } from "./battle-scenes";
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
		playerFlash,
		enemyFlash,
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
		battleLog,
	} = useBattle({
		wildPokemon,
		playerPokemon,
		engine,
		onCatchSuccess: onCatch,
		onRunSuccess: onRun,
	});

	const { playBGM, playCry, preloadCry } = useAudio();

	const [slideFrame, setSlideFrame] = useState(0);
	const [showMenu, setShowMenu] = useState(false);
	const [selectedMove, setSelectedMove] = useState(0);
	const [showDebug, setShowDebug] = useState(false);
	const debugEndRef = useRef<HTMLDivElement>(null);
	const [showCatchAnim, setShowCatchAnim] = useState(false);

	const wildType = TYPE_INFO[wildPokemon.type];

	// Pick a random scene once per battle based on both pokemon types
	const SceneBg = useMemo(
		() =>
			pickBattleScene(
				playerPokemon?.type ?? wildPokemon.type,
				wildPokemon.type,
			),
		[playerPokemon?.type, wildPokemon.type],
	);

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
		setMessage("Oi! No drugs allowed on the premises!");
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
			(move) => move.id === "run",
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
			(move) => move.id === "catch",
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

	return (
		<div className="w-full max-w-md mx-auto flex flex-col">
			{/* Battle arena */}
			<div className="relative aspect-[4/3] overflow-hidden">
				{/* Scene background */}
				<div className="absolute inset-0 overflow-hidden">
					<SceneBg />
				</div>
				{/* Vignette */}
				<div
					className="absolute inset-0 pointer-events-none z-[1]"
					style={{
						background:
							"radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
					}}
				/>

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
						<>
							<div
								style={{
									filter: enemyFlash ? "brightness(3) saturate(0)" : undefined,
									transition: "filter 0.1s steps(1)",
								}}
							>
								<PixelSprite
									name={wildPokemon.sprite}
									size={80}
									animated
									variant={wildPokemon.spriteVariant}
								/>
							</div>
							{/* Shadow */}
							<div
								style={{
									width: "60%",
									height: 6,
									margin: "0 auto",
									background:
										"radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%)",
									borderRadius: "50%",
								}}
							/>
						</>
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
							<div
								style={{
									filter: playerFlash ? "brightness(3) saturate(0)" : undefined,
									transition: "filter 0.1s steps(1)",
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
							{/* Shadow */}
							<div
								style={{
									width: "50%",
									height: 8,
									margin: "0 auto",
									background:
										"radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%)",
									borderRadius: "50%",
								}}
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
								disabled={!playerPokemon || isAnimating}
								className="pix-btn font-pixel text-gba-[9]"
							>
								FIGHT
							</button>
							<button
								onClick={handleCatch}
								disabled={isAnimating}
								className="pix-btn pix-btn--catch font-pixel text-gba-[9]"
							>
								CATCH
							</button>
							<button
								onClick={handleBag}
								disabled={isAnimating}
								className="pix-btn font-pixel text-gba-[9]"
							>
								BAG
							</button>
							<button
								onClick={handleRun}
								disabled={isAnimating}
								className="pix-btn pix-btn--run font-pixel text-gba-[9]"
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
									.filter(
										({ move }) => move.id !== "run" && move.id !== "catch",
									)
									.map(({ move, originalIdx }) => {
										const isDisabled =
											move.disabled || move.pp <= 0 || isAnimating;
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
												className="pix-btn font-pixel text-gba-[9] text-left"
												style={{
													borderLeft: `4px solid ${TYPE_INFO[playerPokemon.type].color}`,
												}}
											>
												<div className="flex items-center justify-between">
													<span>{move.move.toUpperCase()}</span>
													<span className="text-pixel-black/50">
														{move.pp}/{move.maxpp}
													</span>
												</div>
											</button>
										);
									})}
							</div>
							<button
								onClick={() => setMenu("main")}
								className="w-full pix-btn font-pixel text-gba-[9]"
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
								disabled={isAnimating}
								className="pix-btn pix-btn--catch font-pixel text-gba-[9]"
							>
								CATCH
							</button>
							<button
								onClick={handleRun}
								disabled={isAnimating}
								className="pix-btn pix-btn--run font-pixel text-gba-[9]"
							>
								RUN
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Battle End Overlay - only for win/loss */}
			{/* Debug log toggle */}
			<div className="px-2">
				<button
					onClick={() => {
						setShowDebug((d) => !d);
						setTimeout(() => debugEndRef.current?.scrollIntoView(), 50);
					}}
					className="font-[ui-monospace] text-[10px] text-pixel-black/40 hover:text-pixel-black/70 cursor-pointer bg-transparent border-none p-0"
				>
					{showDebug ? "▼ hide debug" : "▶ debug log"}
				</button>
				{showDebug && (
					<div className="mt-1 max-h-48 overflow-y-auto bg-black/90 rounded p-2 font-mono text-[10px] leading-tight">
						{battleLog.map((entry, i) => (
							<div
								key={i}
								className={cn(
									entry.dir === "out" ? "text-green-400" : "text-gray-300",
									"font-[ui-monospace]",
								)}
							>
								<span className="text-gray-500 font-[ui-monospace]">
									{String(entry.ts % 100000).padStart(5, "0")}{" "}
								</span>
								<span
									className={
										entry.dir === "out" ? "text-green-600" : "text-blue-400"
									}
								>
									{entry.dir === "out" ? "→" : "←"}{" "}
								</span>
								{entry.line}
							</div>
						))}
						<div ref={debugEndRef} />
					</div>
				)}
			</div>

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
