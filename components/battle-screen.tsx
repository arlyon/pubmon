"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBattle } from "@/hooks/use-battle";
import { type PubMon, TYPE_INFO } from "@/lib/pokemon-data";
import PixelBox from "./pixel/PixelBox";
import PixelHPBar from "./pixel/PixelHPBar";
import PixelTextBox from "./pixel/PixelTextBox";
import { PixelSprite, TypeBadge } from "./pixel-sprite";

const STATUS_COLORS: Record<
	string,
	{ bg: string; text: string; label: string }
> = {
	brn: { bg: "#e43b44", text: "#fff", label: "BRN" },
	psn: { bg: "#a86dd9", text: "#fff", label: "PSN" },
	tox: { bg: "#a86dd9", text: "#fff", label: "TOX" },
	par: { bg: "#ffd500", text: "#1a1c2c", label: "PAR" },
	slp: { bg: "#6e7a8a", text: "#fff", label: "SLP" },
	frz: { bg: "#00c2ff", text: "#1a1c2c", label: "FRZ" },
};

function StatusBadge({ status }: { status: string | null }) {
	if (!status) return null;
	const statusInfo = STATUS_COLORS[status.toLowerCase()];
	if (!statusInfo) return null;

	return (
		<span
			className="font-pixel text-[4px] px-[2px] py-[1px] rounded-sm"
			style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
		>
			{statusInfo.label}
		</span>
	);
}

interface BattleScreenProps {
	wildPokemon: PubMon;
	playerPokemon: PubMon | null;
	onFight: () => void;
	onCatch: () => void;
	onRun: () => void;
	onBattleEnd?: (result: "win" | "loss") => void;
}

const SLIDE_FRAMES = 16;
const FRAME_MS = 30;

export function BattleScreen({
	wildPokemon,
	playerPokemon,
	onFight,
	onCatch,
	onRun,
	onBattleEnd,
}: BattleScreenProps) {
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
	} = useBattle({ wildPokemon, playerPokemon });

	const [showCatchAnim, setShowCatchAnim] = useState(false);
	const [slideFrame, setSlideFrame] = useState(0);
	const [showMenu, setShowMenu] = useState(false);
	const [selectedMove, setSelectedMove] = useState(0);

	const wildType = TYPE_INFO[wildPokemon.type];

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
	}, []);

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
	const playerOffset = Math.round(((1 - eased) * 160) / 2) * 2;
	const enemyOffset = Math.round(((1 - eased) * 160) / 2) * 2;

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
						transform: `translateX(${enemyOffset}px)`,
						transition: "none",
					}}
				>
					{slideFrame >= SLIDE_FRAMES && (
						<PixelBox className="bg-transparent">
							<div className="flex items-center gap-1 mb-[2px]">
								<span className="font-pixel text-[6px] text-pixel-black">
									{wildPokemon.name.toUpperCase()}
								</span>
								<TypeBadge type={wildPokemon.type} />
								{enemyActivePokemon?.status && (
									<StatusBadge status={enemyActivePokemon.status} />
								)}
							</div>
							<span className="font-pixel text-[5px] text-pixel-black block mb-[2px]">
								Lv{wildPokemon.level}
							</span>
							<PixelHPBar current={enemyHp} max={wildPokemon.maxHp} />
						</PixelBox>
					)}
				</div>

				{/* Wild pokemon sprite */}
				<div
					className="absolute top-8 right-12 z-10"
					style={{
						transform: `translateX(${enemyOffset}px)`,
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
						<PixelSprite name={wildPokemon.sprite} size={8} animated />
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
								<PixelBox className="bg-transparent">
									<div className="flex items-center gap-1 mb-[2px]">
										<span className="font-pixel text-[6px] text-pixel-black">
											{playerPokemon.name.toUpperCase()}
										</span>
										<TypeBadge type={playerPokemon.type} />
										{playerActivePokemon?.status && (
											<StatusBadge status={playerActivePokemon.status} />
										)}
									</div>
									<span className="font-pixel text-[5px] text-pixel-black block mb-[2px]">
										Lv{playerPokemon.level}
									</span>
									<PixelHPBar
										current={playerHp}
										max={playerPokemon.maxHp}
										label="HP"
									/>
								</PixelBox>
							)}
						</div>

						<div
							className="absolute bottom-8 left-12 z-10"
							style={{
								transform: `translateX(-${playerOffset}px)`,
								transition: "none",
								animation: playerShake
									? "pixel-shake 0.3s ease-in-out"
									: undefined,
							}}
						>
							<PixelSprite
								name={playerPokemon.sprite}
								size={8}
								flipped
								animated
							/>
						</div>
					</>
				)}

				{/* Scanlines */}
				<div
					className="absolute inset-0 pointer-events-none z-20 opacity-5"
					style={{
						backgroundImage:
							"repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)",
					}}
				/>
			</div>

			{/* Bottom UI panel */}
			<div className="p-2">
				{/* Message display */}
				{(menu === "message" || message) && (
					<div className="mb-2">
						<PixelTextBox text={message || ""} showContinue={false} rows={2} />
					</div>
				)}

				{/* Main menu */}
				{showMenu && menu === "main" && !message && (
					<div className="grid grid-cols-2 gap-[2px]">
						<button
							onClick={() => setMenu("fight")}
							disabled={!playerPokemon}
							className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light disabled:opacity-50"
						>
							FIGHT
						</button>
						<button
							onClick={handleCatch}
							className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
						>
							CATCH
						</button>
						<button
							onClick={handleBag}
							className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
						>
							BAG
						</button>
						<button
							onClick={handleRun}
							className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
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
								{playerActivePokemon.moves.length > 0
									? playerActivePokemon.moves.map((move, idx) => {
											console.log(`Rendering move ${idx}:`, {
												name: move.name,
												pp: move.pp,
												maxpp: move.maxpp,
												disabled: move.disabled,
												isDisabled: move.disabled || move.pp <= 0,
											});
											return (
												<button
													key={move.name}
													onClick={() => {
														if (!move.disabled && move.pp > 0) {
															setSelectedMove(idx);
															handleAttack(idx);
														}
													}}
													disabled={move.disabled || move.pp <= 0}
													className={`pixel-box cursor-pointer font-pixel text-[6px] text-center py-[4px] border-none ${
														move.disabled || move.pp <= 0
															? "bg-pixel-gray-light opacity-50 cursor-not-allowed"
															: idx === selectedMove
																? "bg-pixel-gray-light"
																: "bg-pixel-white hover:bg-pixel-gray-light"
													}`}
												>
													<div className="flex flex-col items-center text-black">
														<span>{move.name.toUpperCase()}</span>
														<span className="text-[4px] text-pixel-black/70">
															PP: {move.pp}/{move.maxpp}
														</span>
													</div>
												</button>
											);
										})
									: // Fallback to original moves if state not yet extracted
										playerPokemon.moves.map((move, idx) => (
											<button
												key={move}
												onClick={() => {
													setSelectedMove(idx);
													handleAttack(idx);
												}}
												className={`pixel-box cursor-pointer font-pixel text-[6px] text-center py-[6px] border-none ${
													idx === selectedMove
														? "bg-pixel-gray-light"
														: "bg-pixel-white"
												} hover:bg-pixel-gray-light`}
											>
												{move.toUpperCase()}
											</button>
										))}
							</div>
							<button
								onClick={() => setMenu("main")}
								className="w-full pixel-box cursor-pointer font-pixel text-[5px] text-pixel-black text-center py-[4px] border-none bg-pixel-white hover:bg-pixel-gray-light"
							>
								BACK
							</button>
						</div>
					)}

				{/* No player pokemon message */}
				{showMenu && !playerPokemon && menu === "main" && !message && (
					<div>
						<div className="mb-2">
							<PixelTextBox
								text={`You have no PubMon! Try to catch this wild ${wildPokemon.name.toUpperCase()}!`}
								showContinue={false}
								rows={2}
							/>
						</div>
						<div className="grid grid-cols-2 gap-[2px]">
							<button
								onClick={handleCatch}
								className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
							>
								CATCH
							</button>
							<button
								onClick={handleRun}
								className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
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
								<h2 className="font-pixel text-[14px] text-pixel-black">
									{battleResult === "win" ? "VICTORY!" : "DEFEATED..."}
								</h2>
								<p className="font-pixel text-[8px] text-pixel-black/70 text-center">
									{battleResult === "win"
										? `You defeated the wild ${wildPokemon.name}!`
										: `You were defeated by the wild ${wildPokemon.name}!`}
								</p>
								<button
									onClick={() => onBattleEnd?.(battleResult)}
									className="pixel-box cursor-pointer font-pixel text-[8px] text-pixel-black text-center px-8 py-3 border-none bg-primary text-primary-foreground hover:brightness-110"
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
