"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";
import { GYMS, type Gym } from "@/lib/gym-data";
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
}

export function GymHeader({
	currentGymId,
	badges = new Set(),
	className,
	onSelectGym,
}: GymHeaderProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	const currentGym = GYMS.find((g) => g.id === currentGymId) || GYMS[0]!;
	const typeColor = TYPE_COLORS[currentGym.specialty] ?? {
		bg: "#2038a0",
		text: "#f8f8f8",
	};

	return (
		<div className={cn("w-full absolute z-50", className)}>
			<div
				className="w-full font-sans relative"
				style={{
					border: "var(--pixel-border)",
					borderTop: "none",
					borderLeft: "none",
					borderRight: "none",
					fontFamily: "'Press Start 2P', monospace",
				}}
			>
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
								fontSize: 6,
								color: "#78b8f0",
								borderBottom: "1px solid #181010",
							}}
						>
							<span>▶ PUBMON LEAGUE</span>
							<span>GYM {currentGym.id}/10</span>
						</div>

						{/* Gym name banner */}
						<div
							style={{
								padding: "6px 8px 4px",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
							}}
						>
							<div className="text-left">
								<div style={{ fontSize: 8, color: "#a8c8f0", marginBottom: 3 }}>
									Current Gym
								</div>
								<div
									style={{ fontSize: 8, color: "#f8f8f8", letterSpacing: 1 }}
								>
									{currentGym.name.toUpperCase()}
								</div>
							</div>
							<div
								style={{
									background: typeColor.bg,
									color: typeColor.text,
									fontSize: 6,
									padding: "2px 5px",
									border: "1px solid #181010",
									boxShadow: "1px 1px 0 #181010",
								}}
							>
								{currentGym.specialty.toUpperCase()}
							</div>
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
									currentGymId={currentGymId}
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
					<div style={{ fontSize: 6, color: "#f0e070" }}>🏠</div>
					<div style={{ flex: 1, textAlign: "left" }}>
						<div style={{ fontSize: 6, color: "#f8f8f8" }}>
							{currentGym.pub}
						</div>
						<div style={{ fontSize: 5, color: "#78a8d8", marginTop: 2 }}>
							{currentGym.address}
						</div>
					</div>
					<div style={{ textAlign: "right" }}>
						<div style={{ fontSize: 5, color: "#a8c8f0" }}>LEADER</div>
						<div style={{ fontSize: 7, color: "#f8d858" }}>
							{currentGym.leaderName}
						</div>
					</div>
				</button>

				{/* Badge reward - always visible below */}
				<button
					type="button"
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full cursor-pointer group"
					style={{
						background: "#101828",
						padding: "3px 8px",
						fontSize: 6,
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
					<div className="text-muted-foreground text-[12px] group-hover:text-primary transition-colors">
						{isExpanded ? "▼" : "▶"}
					</div>
				</button>
			</div>
		</div>
	);
}
