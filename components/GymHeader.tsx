"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";
import { GYMS, type Gym, MASTER_TOURNAMENT } from "@/lib/gym-data";
import { cn } from "@/lib/utils";
import { GymTrailInline } from "./gym-trail";

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
	Beer: { bg: "#f8b830", text: "#181010" },
	Cocktail: { bg: "#e878e8", text: "#f8f8f8" },
	Shot: { bg: "#f85858", text: "#f8f8f8" },
	Wine: { bg: "#a030d0", text: "#f8f8f8" },
	Water: { bg: "#63c6e1", text: "#181010" },
};

interface GymHeaderProps {
	currentGymId: number;
	badges: Set<number>;
	className?: string;
	onSelectGym?: (gymId: number) => void;
	tournamentWinner?: string;
	gamePhase?: "collection" | "tournament" | "hall-of-fame";
	activeBattleId?: string;
	activeBattleOpponent?: string;
	onJoinBattle?: () => void;
}

export function GymHeader({
	currentGymId,
	badges = new Set(),
	className,
	onSelectGym,
	tournamentWinner,
	gamePhase = "collection",
	activeBattleId,
	activeBattleOpponent,
	onJoinBattle,
}: GymHeaderProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	// When in tournament phase, override and show tournament regardless of currentGymId
	const effectiveGymId =
		gamePhase === "tournament" ? MASTER_TOURNAMENT.id : currentGymId;

	const currentGym =
		Number(effectiveGymId) === MASTER_TOURNAMENT.id ||
		gamePhase === "tournament"
			? {
					id: MASTER_TOURNAMENT.id,
					name: MASTER_TOURNAMENT.name,
					subtitle: MASTER_TOURNAMENT.subtitle,
					badgeColor: MASTER_TOURNAMENT.badgeColor,
					badgeSprite: "",
					requiredDrinks: 0,
					specialty: MASTER_TOURNAMENT.specialty,
					leaderName: tournamentWinner || "???",
					badgeName: "Champion Trophy",
					pub: "Grand Pub League Arena",
					address: "Elite District",
				}
			: GYMS.find((g) => g.id === currentGymId) || GYMS[0]!;
	const typeColor = TYPE_COLORS[currentGym.specialty] ?? {
		bg: "#2038a0",
		text: "#f8f8f8",
	};

	return (
		<div className={cn("w-full absolute z-50", className)}>
			<div className="w-full font-sans relative [font-palette:--emerald-blue] text-gba-[9] leading-none">
				{/* Blue expandable section */}
				<motion.div
					layout
					style={{ background: "#2038a0", overflow: "hidden" }}
					animate={{
						height: "auto",
					}}
				>
					<button
						type="button"
						onClick={() => setIsExpanded(!isExpanded)}
						className="w-full cursor-pointer group"
					>
						{/* Top status bar */}
						<div
							style={{
								background: "#101828",
								padding: "3px 6px",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								color: "#78b8f0",
								borderBottom: "1px solid #181010",
							}}
						>
							<span>
								PUBMON LEAGUE{" "}
								{gamePhase === "tournament" && (
									<span style={{ color: "#f8b830" }}>• TOURNAMENT</span>
								)}
								{gamePhase === "hall-of-fame" && (
									<span style={{ color: "#f0e070" }}>• HALL OF FAME</span>
								)}
							</span>
							<span>
								{Number(effectiveGymId) === MASTER_TOURNAMENT.id
									? null
									: `GYM ${currentGym.id}/10`}
							</span>
						</div>

						{/* Active Battle Alert - shows when player has an ongoing battle */}
						{activeBattleId && activeBattleOpponent && (
							<div
								className="text-gba-[6] animate-pulse"
								style={{
									background: "#f85858",
									padding: "6px 8px",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									color: "#f8f8f8",
									borderBottom: "2px solid #c83030",
								}}
								onClick={(e) => {
									e.stopPropagation();
									if (onJoinBattle) {
										onJoinBattle();
									}
								}}
							>
								<span>⚔ BATTLE IN PROGRESS</span>
								<span>vs {activeBattleOpponent}</span>
							</div>
						)}

						{/* Gym name banner */}
						<div
							style={{
								padding: "6px 8px 4px",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
							}}
						>
							<div className="text-left gap-[4px] flex flex-col">
								<div className="text-gba-[9] leading-none [font-palette:--emerald-blue]">
									Current Gym
								</div>
								<div className="text-gba-[9] leading-none font-heading text-white tracking-wide">
									{currentGym.name.toUpperCase()}
								</div>
							</div>
							{gamePhase === "tournament" ? (
								activeBattleId && onJoinBattle ? (
									<button
										type="button"
										className="text-gba-[6] border-gba-[1] border-black hover:brightness-110 transition-all animate-pulse"
										style={{
											background: "#f85858",
											color: "#f8f8f8",
											padding: "3px 6px",
											boxShadow: "1px 1px 0 #181010",
											cursor: "pointer",
										}}
										onClick={(e) => {
											e.stopPropagation();
											onJoinBattle();
										}}
									>
										⚔ ENTER BATTLE
									</button>
								) : null
							) : (
								<div
									className="text-gba-[6] border-gba-[1] border-black"
									style={{
										background: typeColor.bg,
										color: typeColor.text,
										padding: "2px 5px",
										boxShadow: "1px 1px 0 #181010",
									}}
								>
									{currentGym.specialty.toUpperCase()}
								</div>
							)}
						</div>
					</button>

					{/* Trail - shows when expanded */}
					<AnimatePresence>
						{isExpanded && (
							<motion.div
								initial={{ height: 0 }}
								animate={{ height: "calc(100vh - 110px)" }}
								exit={{ height: 0 }}
								transition={{ duration: 0.4, ease: "easeInOut" }}
								className="h-full"
							>
								<GymTrailInline
									currentGymId={effectiveGymId}
									badges={badges}
									onSelectGym={(gymId) => {
										if (onSelectGym) {
											onSelectGym(gymId);
										}
										setIsExpanded(false);
									}}
									onClose={() => setIsExpanded(false)}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</motion.div>

				{/* Pub info row - always visible below */}
				<button
					type="button"
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full"
					style={{
						background: "#182860",
						padding: "4px 8px",
						display: "flex",
						gap: 8,
						alignItems: "center",
						borderTop: "1px solid #101828",
					}}
				>
					<div style={{ color: "#f0e070" }}>🏠</div>
					<div style={{ flex: 1, textAlign: "left" }}>
						<div style={{ color: "#f8f8f8" }}>{currentGym.pub}</div>
						<div style={{ color: "#78a8d8", marginTop: 2 }}>
							{currentGym.address}
						</div>
					</div>
					<div style={{ textAlign: "right" }}>
						<div style={{ color: "#a8c8f0" }}>LEADER</div>
						<div style={{ color: "#f8d858" }}>{currentGym.leaderName}</div>
					</div>
				</button>

				{/* Badge reward - always visible below */}
				<button
					type="button"
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full cursor-pointer group px-gba-[4] py-gba-[2]"
					style={{
						background: "#101828",
						color: "#f8b830",
						borderTop: "1px solid #181010",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<span style={{ color: "#78b8f0" }}>PRIZE:</span>
						<span>★ {currentGym.badgeName}</span>
					</div>
					<div className="text-muted-foreground text-gba-[4] group-hover:text-primary transition-colors">
						{isExpanded ? "▼" : "▶"}
					</div>
				</button>
			</div>
		</div>
	);
}
