"use client";

import React, { useRef, useState } from "react";
import type { PubMon } from "@/lib/pokemon-data";
import { TYPE_INFO } from "@/lib/pokemon-data";
import { cn } from "@/lib/utils";
import type { ActivePokemon, BattleMenu } from "@/hooks/use-battle";
import PixelBox from "./pixel/PixelBox";
import PixelStatCard from "./pixel/PixelStatCard";
import PixelTextBox from "./pixel/PixelTextBox";
import { PixelSprite } from "./pixel-sprite";

interface MoveInfo {
	id: string;
	move: string;
	pp: number;
	maxpp: number;
	disabled: boolean;
}

export interface BattleScreenViewProps {
	wildPokemon: PubMon;
	playerPokemon: PubMon | null;
	/** Current menu state */
	menu: BattleMenu;
	/** Battle message to display */
	message: string | null;
	/** Enemy HP (0-maxHp) */
	enemyHp: number;
	/** Player HP (0-maxHp) */
	playerHp: number;
	/** Whether an animation is in progress */
	isAnimating: boolean;
	/** Animation states */
	playerShake?: boolean;
	enemyShake?: boolean;
	playerFlash?: boolean;
	enemyFlash?: boolean;
	playerAttacking?: boolean;
	enemyAttacking?: boolean;
	/** Active pokemon state from battle engine */
	playerActivePokemon?: ActivePokemon | null;
	enemyActivePokemon?: ActivePokemon | null;
	/** Whether the intro slide-in is complete */
	introComplete?: boolean;
	/** Whether to show the catch animation */
	showCatchAnim?: boolean;
	/** Available moves for fight menu */
	moves?: MoveInfo[];
	/** Battle log entries */
	battleLog?: { dir: "in" | "out"; line: string; ts: number }[];
	/** Scene background component */
	SceneBg?: React.ComponentType;
	/** Handlers */
	onFight?: () => void;
	onCatch?: () => void;
	onBag?: () => void;
	onRun?: () => void;
	onSelectMove?: (moveIndex: number) => void;
	onBackToMain?: () => void;
	onContinueMessage?: () => void;
}

function DefaultSceneBg() {
	return (
		<div
			className="w-full h-full"
			style={{
				background:
					"linear-gradient(180deg, #87CEEB 0%, #98FB98 60%, #228B22 100%)",
			}}
		/>
	);
}

export function BattleScreenView({
	wildPokemon,
	playerPokemon,
	menu,
	message,
	enemyHp,
	playerHp,
	isAnimating,
	playerShake = false,
	enemyShake = false,
	playerFlash = false,
	enemyFlash = false,
	playerAttacking = false,
	enemyAttacking = false,
	playerActivePokemon,
	enemyActivePokemon,
	introComplete = true,
	showCatchAnim = false,
	moves = [],
	battleLog = [],
	SceneBg = DefaultSceneBg,
	onFight,
	onCatch,
	onBag,
	onRun,
	onSelectMove,
	onBackToMain,
	onContinueMessage,
}: BattleScreenViewProps) {
	const [showDebug, setShowDebug] = useState(false);
	const debugEndRef = useRef<HTMLDivElement>(null);

	const playerOffset = introComplete ? 0 : 320;
	const enemyOffset = introComplete ? 0 : 320;

	const showMenu = introComplete;

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
					{introComplete && (
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
						animation: enemyShake
							? "pixel-shake 0.3s ease-in-out"
							: undefined,
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
									filter: enemyFlash
										? "brightness(3) saturate(0)"
										: undefined,
									transition: "filter 0.1s steps(1)",
								}}
							>
								<PixelSprite
									name={wildPokemon.sprite}
									size={48}
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
							{introComplete && (
								<PixelStatCard
									pokemon={playerPokemon}
									currentHp={playerHp}
									maxHp={playerActivePokemon?.maxhp}
									status={playerActivePokemon?.status}
									showHpNumbers
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
									filter: playerFlash
										? "brightness(3) saturate(0)"
										: undefined,
									transition: "filter 0.1s steps(1)",
								}}
							>
								<PixelSprite
									name={playerPokemon.sprite}
									size={56}
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
						onClick={onContinueMessage}
						className="w-full mb-2 text-left cursor-pointer border-none bg-transparent p-0 flex flex-col focus:outline-none"
					>
						<PixelTextBox text={message} showContinue={true} rows={2} />
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
								<p className=" text-gba-[9] text-pixel-black">
									What will{" "}
									{playerPokemon ? (
										<span
											className="font-bold"
											style={{
												color: TYPE_INFO[playerPokemon.type].color,
											}}
										>
											{playerPokemon.name.toUpperCase()}
										</span>
									) : (
										<span className="font-bold text-pixel-black/70">
											YOU
										</span>
									)}{" "}
									do?
								</p>
							</div>
						</PixelBox>
						<div className="grid grid-cols-2 gap-[2px]">
							<button
								onClick={onFight}
								disabled={!playerPokemon || isAnimating}
								className="pix-btn  text-gba-[9]"
							>
								FIGHT
							</button>
							<button
								onClick={onCatch}
								disabled={isAnimating}
								className="pix-btn pix-btn--catch  text-gba-[9]"
							>
								CATCH
							</button>
							<button
								onClick={onBag}
								disabled={isAnimating}
								className="pix-btn  text-gba-[9]"
							>
								BAG
							</button>
							<button
								onClick={onRun}
								disabled={isAnimating}
								className="pix-btn pix-btn--run  text-gba-[9]"
							>
								RUN
							</button>
						</div>
					</div>
				)}

				{/* Fight submenu - move selection */}
				{menu === "fight" && !message && playerPokemon && moves.length > 0 && (
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
								<p className=" text-gba-[9] text-pixel-black">
									What will{" "}
									<span
										className="font-bold"
										style={{
											color: TYPE_INFO[playerPokemon.type].color,
										}}
									>
										{playerPokemon.name.toUpperCase()}
									</span>{" "}
									do?
								</p>
							</div>
						</PixelBox>
						<div className="grid grid-cols-2 gap-[2px] mb-[2px]">
							{moves
								.filter((move) => move.id !== "run" && move.id !== "catch")
								.map((move) => {
									const isDisabled =
										move.disabled || move.pp <= 0 || isAnimating;
									return (
										<button
											type="button"
											key={move.id}
											onClick={() => {
												if (!isDisabled) onSelectMove?.(moves.indexOf(move));
											}}
											disabled={isDisabled}
											className="pix-btn  text-gba-[9] text-left"
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
							onClick={onBackToMain}
							className="w-full pix-btn  text-gba-[9]"
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
								<p className=" text-gba-[9] text-pixel-black">
									What will{" "}
									<span className="font-bold text-pixel-black/70">
										YOU
									</span>{" "}
									do?
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
								onClick={onCatch}
								disabled={isAnimating}
								className="pix-btn pix-btn--catch  text-gba-[9]"
							>
								CATCH
							</button>
							<button
								onClick={onRun}
								disabled={isAnimating}
								className="pix-btn pix-btn--run  text-gba-[9]"
							>
								RUN
							</button>
						</div>
					</div>
				)}
			</div>

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
									entry.dir === "out"
										? "text-green-400"
										: "text-gray-300",
									"font-[ui-monospace]",
								)}
							>
								<span className="text-gray-500 font-[ui-monospace]">
									{String(entry.ts % 100000).padStart(5, "0")}{" "}
								</span>
								<span
									className={
										entry.dir === "out"
											? "text-green-600"
											: "text-blue-400"
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
		</div>
	);
}
