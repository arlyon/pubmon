"use client";

import { useEffect, useRef } from "react";
import { GYMS, type Gym, MASTER_TOURNAMENT } from "@/lib/gym-data";

function BadgeIcon({
	sprite,
	earned,
	size = 3,
	id,
}: {
	sprite: string;
	earned: boolean;
	size?: number;
	id: number;
}) {
	const offset = 0.25 * (id % 7);

	return (
		<img
			src={sprite}
			alt="Badge"
			width={size * 8}
			height={size * 8}
			className={earned ? "" : "opacity-30 grayscale"}
			style={{
				imageRendering: "pixelated",
				animation: `pixel-bounce 1.0s steps(1, end) ${offset}s infinite`,
			}}
		/>
	);
}

interface GymTrailProps {
	currentGymId: number;
	badges: Set<number>;
	onSelectGym: (gymId: number) => void;
	onClose: () => void;
}

/** SVG path segment connecting two nodes along the trail */
function PathSegment({
	fromX,
	toX,
	filled,
}: {
	fromX: string;
	toX: string;
	filled: boolean;
}) {
	// Convert percentages to approximate pixel positions for the SVG path
	const fromPx = parseFloat(fromX);
	const toPx = parseFloat(toX);

	return (
		<div className="absolute inset-0 pointer-events-none overflow-visible">
			<svg
				className="absolute inset-0 w-full h-full"
				viewBox="0 0 100 120"
				preserveAspectRatio="none"
				style={{ overflow: "visible" }}
			>
				<path
					d={`M ${fromPx} 60 C ${fromPx} 100, ${toPx} 20, ${toPx} 60`}
					fill="none"
					stroke={filled ? "#e8c17066" : "#3a446666"}
					strokeWidth={3}
					strokeDasharray={filled ? "none" : "4 4"}
				/>
				{/* Dotted overlay for unfilled */}
				{filled && (
					<path
						d={`M ${fromPx} 60 C ${fromPx} 100, ${toPx} 20, ${toPx} 60`}
						fill="none"
						stroke="#e8c170"
						strokeWidth={1}
						strokeDasharray="2 3"
					/>
				)}
			</svg>
		</div>
	);
}

/** Inline version of GymTrail for embedding in GymHeader */
export function GymTrailInline({
	currentGymId,
	badges,
	onSelectGym,
	onClose,
}: GymTrailProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const currentRef = useRef<HTMLDivElement>(null);

	// Scroll to current gym on mount
	// useEffect(() => {
	// 	if (currentRef.current && scrollRef.current) {
	// 		const container = scrollRef.current;
	// 		const el = currentRef.current;
	// 		// Scroll so current gym is roughly centered
	// 		const top =
	// 			el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
	// 		container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
	// 	}
	// }, []);

	const allBadges = badges.size >= 10;

	// Build the path nodes: gyms from bottom (10) to top (1), then master tournament
	const nodes = [...GYMS].reverse();

	return (
		<div className="w-full h-full bg-[#2038a0] flex flex-col">
			{/* Scrollable trail */}
			<div ref={scrollRef} className="overflow-y-auto overflow-x-hidden flex-1">
				<div
					className="relative py-8 px-6"
					style={{ minHeight: nodes.length * 120 + 200 }}
				>
					{/* Master Tournament at top */}
					<div className="flex flex-col items-center mb-8">
						<div
							className={`
                relative w-20 h-20 border-4 flex items-center justify-center
                ${
									allBadges
										? "border-primary bg-primary/20 shadow-[0_0_20px_rgba(232,193,112,0.5)]"
										: "border-foreground/20 bg-card/50"
								}
              `}
							style={{
								clipPath:
									"polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
							}}
						>
							{/* Crown icon */}
							<svg
								viewBox="0 0 10 8"
								width={32}
								height={26}
								style={{ imageRendering: "pixelated" }}
							>
								<rect
									x={0}
									y={2}
									width={2}
									height={2}
									fill={allBadges ? "#e8c170" : "#3a4466"}
								/>
								<rect
									x={4}
									y={0}
									width={2}
									height={2}
									fill={allBadges ? "#e8c170" : "#3a4466"}
								/>
								<rect
									x={8}
									y={2}
									width={2}
									height={2}
									fill={allBadges ? "#e8c170" : "#3a4466"}
								/>
								<rect
									x={0}
									y={4}
									width={10}
									height={2}
									fill={allBadges ? "#e8c170" : "#3a4466"}
								/>
								<rect
									x={1}
									y={6}
									width={8}
									height={2}
									fill={allBadges ? "#c28b4a" : "#262b44"}
								/>
							</svg>
						</div>
						<p
							className={`text-[9px] mt-2 text-center ${allBadges ? "text-primary" : "text-muted-foreground/50"}`}
						>
							{MASTER_TOURNAMENT.name}
						</p>
						<p
							className={`text-[7px] mt-0.5 ${allBadges ? "text-foreground" : "text-muted-foreground/30"}`}
						>
							{allBadges ? "UNLOCKED" : "COLLECT ALL 10 BADGES"}
						</p>
					</div>

					{/* Winding path with gym nodes */}
					{nodes.map((gym, index) => {
						const isEarnedBadge = badges.has(gym.id);
						const isCurrent = gym.id === currentGymId;
						const isAccessible = gym.id <= currentGymId || isEarnedBadge;

						// Weave left/right: alternate based on index
						// 0=center, 1=right, 2=center, 3=left, 4=center, 5=right...
						const pattern = index % 4;
						let xOffset: string;
						if (pattern === 0) xOffset = "50%";
						else if (pattern === 1) xOffset = "72%";
						else if (pattern === 2) xOffset = "50%";
						else xOffset = "28%";

						return (
							<div key={gym.id} className="relative" style={{ height: 120 }}>
								{/* Connecting path line to next node */}
								{index < nodes.length - 1 && (
									<PathSegment
										fromX={xOffset}
										toX={(() => {
											const nextPattern = (index + 1) % 4;
											if (nextPattern === 0) return "50%";
											if (nextPattern === 1) return "72%";
											if (nextPattern === 2) return "50%";
											return "28%";
										})()}
										filled={isEarnedBadge}
									/>
								)}

								{/* Also draw path from master tournament to first node */}
								{index === 0 && (
									<div
										className="absolute w-[3px] bg-foreground/10"
										style={{
											left: xOffset,
											top: -32,
											height: 32,
											transform: "translateX(-50%)",
										}}
									/>
								)}

								{/* Gym node */}
								<div
									ref={isCurrent ? currentRef : undefined}
									className="absolute"
									style={{
										left: xOffset,
										top: "50%",
										transform: "translate(-50%, -50%)",
									}}
								>
									<button
										type="button"
										onClick={() => {
											if (isAccessible) onSelectGym(gym.id);
										}}
										disabled={!isAccessible}
										className={`
                      relative flex flex-col items-center gap-1.5 cursor-pointer
                      disabled:cursor-not-allowed group font-sans font-palette-blue
                    `}
									>
										{/* Current indicator */}
										{isCurrent && (
											<div className="absolute -top-5 left-1/2 -translate-x-1/2">
												<div
													className="text-primary text-[8px]"
													style={{
														animation: "pixel-bounce 1s ease-in-out infinite",
													}}
												>
													{">> YOU <<"}
												</div>
											</div>
										)}

										{/* Badge circle */}
										<div
											className={`
                        w-14 h-14 border-4 flex items-center justify-center transition-all
                        ${
													isCurrent
														? "border-primary bg-card shadow-[0_0_12px_rgba(232,193,112,0.4)] scale-110"
														: isEarnedBadge
															? "border-foreground/60 bg-card"
															: "border-foreground/15 bg-card/30"
												}
                        ${isAccessible && !isCurrent ? "group-hover:border-primary/50 group-hover:scale-105" : ""}
                      `}
										>
											{isEarnedBadge ? (
												<BadgeIcon
													sprite={gym.badgeSprite}
													earned={true}
													size={3}
													id={index}
												/>
											) : (
												/* Silhouette */
												<BadgeIcon
													sprite={gym.badgeSprite}
													earned={false}
													size={3}
													id={index}
												/>
											)}
										</div>

										{/* Gym name label */}
										<div
											className={`text-center ${isAccessible ? "" : "opacity-30"}`}
										>
											<p
												className={`text-[8px] leading-tight ${isCurrent ? "text-primary" : isEarnedBadge ? "text-foreground" : "text-muted-foreground"}`}
											>
												{gym.name}
											</p>
											<p className="text-[6px] text-muted-foreground leading-tight mt-0.5">
												{isEarnedBadge ? "BADGE EARNED" : gym.subtitle}
											</p>
										</div>

										{/* Gym number */}
										<div
											className={`
                        absolute -right-2 -top-1 w-5 h-5 flex items-center justify-center border-2 text-[7px]
                        ${
													isCurrent
														? "border-primary bg-primary text-primary-foreground"
														: isEarnedBadge
															? "border-foreground/40 bg-card text-foreground"
															: "border-foreground/15 bg-card/30 text-muted-foreground/50"
												}
                      `}
										>
											{gym.id}
										</div>
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Badge bar at bottom */}
			<div
				className="border-t-4 border-foreground bg-card p-4 flex items-center flex-col"
				style={{ flexShrink: 0 }}
			>
				<p className="text-[8px] text-muted-foreground mb-3 text-center font-bold">
					BADGE COLLECTION
				</p>
				<div className="grid grid-cols-5 items-center justify-center gap-3 w-max">
					{GYMS.map((gym) => (
						<div
							key={gym.id}
							className={`
                  w-9 h-9 border-2 flex items-center justify-center transition-all
                  ${badges.has(gym.id) ? "border-foreground/40 bg-card" : "border-foreground/10 bg-card/30"}
                `}
							title={badges.has(gym.id) ? `${gym.name} Badge` : "???"}
						>
							<BadgeIcon
								sprite={gym.badgeSprite}
								earned={badges.has(gym.id)}
								size={2.5}
								id={gym.id}
							/>
						</div>
					))}
				</div>
				<p className="text-[6px] text-muted-foreground mt-3 text-center">
					{badges.size} / 10 BADGES EARNED
				</p>
			</div>
		</div>
	);
}
