"use client";

import { useState } from "react";
import { GYMS, type Gym, MASTER_TOURNAMENT } from "@/lib/gym-data";

interface GymTrailProps {
	currentGymId: number;
	badges: Set<number>;
	onSelectGym: (gymId: number) => void;
	onClose: () => void;
}

// Pokéball SVG icon
function Pokeball({ size = 10 }: { size?: number }) {
	return (
		<svg
			viewBox="0 0 8 8"
			width={size}
			height={size}
			shapeRendering="crispEdges"
			style={{ display: "block" }}
		>
			<rect x="2" y="0" width="4" height="1" fill="#282828" />
			<rect x="1" y="1" width="6" height="1" fill="#282828" />
			<rect x="0" y="2" width="1" height="4" fill="#282828" />
			<rect x="7" y="2" width="1" height="4" fill="#282828" />
			<rect x="1" y="6" width="6" height="1" fill="#282828" />
			<rect x="2" y="7" width="4" height="1" fill="#282828" />
			<rect x="2" y="1" width="4" height="1" fill="#d03838" />
			<rect x="1" y="2" width="6" height="1" fill="#d03838" />
			<rect x="1" y="3" width="2" height="1" fill="#d03838" />
			<rect x="5" y="3" width="2" height="1" fill="#d03838" />
			<rect x="1" y="4" width="2" height="1" fill="#f8f8f8" />
			<rect x="5" y="4" width="2" height="1" fill="#f8f8f8" />
			<rect x="1" y="5" width="6" height="1" fill="#f8f8f8" />
			<rect x="3" y="3" width="2" height="2" fill="#f8f8f8" />
			<rect x="3" y="3" width="2" height="1" fill="#282828" />
		</svg>
	);
}

// Radial pokéball orbit around the badge center
function PokeballOrbit({ count, radius }: { count: number; radius: number }) {
	if (!count) return null;
	return (
		<>
			{Array.from({ length: count }).map((_, i) => {
				const angle = (360 / count) * i - 90;
				const rad = (angle * Math.PI) / 180;
				const x = Math.cos(rad) * radius;
				const y = Math.sin(rad) * radius;
				return (
					<div
						key={i}
						style={{
							position: "absolute",
							left: "50%",
							top: "50%",
							transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
							pointerEvents: "none",
						}}
					>
						<Pokeball size={7} />
					</div>
				);
			})}
		</>
	);
}

// Badge modal shown when a cleared slot is clicked
function BadgeModal({
	gym,
	onClose,
	onNavigate,
}: {
	gym: Gym;
	onClose: () => void;
	onNavigate: () => void;
}) {
	return (
		<div
			onClick={onClose}
			style={{
				position: "absolute",
				inset: 0,
				background: "rgba(28,28,40,0.82)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 50,
				padding: 16,
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					width: 220,
					background: "#f8f8f8",
					border: "3px solid #282828",
					boxShadow:
						"inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8, 4px 4px 0 0 rgba(0,0,0,0.5)",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* title bar */}
				<div
					style={{
						background: "#f8d030",
						borderBottom: "3px solid #282828",
						padding: "5px 8px",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						fontFamily: "var(--)",
						fontSize: 8,
						color: "#282828",
					}}
				>
					<span>★ BADGE EARNED ★</span>
					<button
						type="button"
						onClick={onClose}
						style={{
							border: "2px solid #282828",
							background: "#f8f8f8",
							color: "#282828",
							width: 16,
							height: 16,
							fontFamily: "var(--)",
							fontSize: 8,
							cursor: "pointer",
							padding: 0,
							lineHeight: 1,
						}}
					>
						×
					</button>
				</div>

				{/* spinning badge */}
				<div
					style={{
						background: "#d0e8f0",
						borderBottom: "3px solid #282828",
						padding: "16px 0",
						display: "flex",
						justifyContent: "center",
						perspective: 800,
						position: "relative",
					}}
				>
					<div
						style={{
							width: 80,
							height: 80,
							position: "relative",
							transformStyle: "preserve-3d",
							animation: "badge-spin 3s linear infinite",
						}}
					>
						{[0, 1, 2, 3, 4].map((layer) => (
							<img
								key={layer}
								src={gym.badgeSprite}
								alt={gym.badgeName}
								width={80}
								height={80}
								style={{
									imageRendering: "pixelated",
									position: "absolute",
									inset: 0,
									transform: `translateZ(${layer * 2}px)`,
									filter:
										layer > 0 ? `brightness(${1 - layer * 0.12})` : "none",
								}}
							/>
						))}
					</div>
				</div>

				{/* info */}
				<div
					style={{
						padding: 10,
						display: "flex",
						flexDirection: "column",
						gap: 5,
						textAlign: "center",
						fontFamily: "var(--)",
					}}
				>
					<div style={{ fontSize: 10, color: "#4878d0" }}>{gym.badgeName}</div>
					<div style={{ fontSize: 7, color: "#686868", lineHeight: 1.6 }}>
						AWARDED BY {gym.leaderName.toUpperCase()}
						<br />
						AT {gym.name.toUpperCase()}
					</div>
					<button
						type="button"
						onClick={onNavigate}
						style={{
							marginTop: 4,
							fontFamily: "var(--)",
							fontSize: 8,
							padding: "7px 10px",
							border: "3px solid #305098",
							background: "#4878d0",
							color: "#f8f8f8",
							cursor: "pointer",
							boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)",
						}}
					>
						GO TO GYM
					</button>
					<button
						type="button"
						onClick={onClose}
						style={{
							fontFamily: "var(--)",
							fontSize: 7,
							padding: "5px 10px",
							border: "2px solid #282828",
							background: "#e8e8e8",
							color: "#282828",
							cursor: "pointer",
						}}
					>
						CLOSE
					</button>
				</div>
			</div>
		</div>
	);
}

// Modal for the active (unearned) gym — spinning black silhouette coin
function UnearnedBadgeModal({
	gym,
	onClose,
	onNavigate,
}: {
	gym: Gym;
	onClose: () => void;
	onNavigate: () => void;
}) {
	return (
		<div
			onClick={onClose}
			style={{
				position: "absolute",
				inset: 0,
				background: "rgba(28,28,40,0.82)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 50,
				padding: 16,
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					width: 220,
					background: "#f8f8f8",
					border: "3px solid #282828",
					boxShadow:
						"inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8, 4px 4px 0 0 rgba(0,0,0,0.5)",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* title bar — dark/locked style */}
				<div
					style={{
						background: "#383028",
						borderBottom: "3px solid #282828",
						padding: "5px 8px",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						fontFamily: "var(--)",
						fontSize: 8,
						color: "#a8a090",
					}}
				>
					<span>? ? ? LOCKED ? ? ?</span>
					<button
						type="button"
						onClick={onClose}
						style={{
							border: "2px solid #282828",
							background: "#5a4838",
							color: "#a8a090",
							width: 16,
							height: 16,
							fontFamily: "var(--)",
							fontSize: 8,
							cursor: "pointer",
							padding: 0,
							lineHeight: 1,
						}}
					>
						×
					</button>
				</div>

				{/* spinning black silhouette coin */}
				<div
					style={{
						background: "#282828",
						borderBottom: "3px solid #282828",
						padding: "16px 0",
						display: "flex",
						justifyContent: "center",
						perspective: 800,
						position: "relative",
					}}
				>
					{/* question mark sparkles */}
					<div
						style={{
							position: "absolute",
							top: 8,
							left: 24,
							color: "#5a4838",
							fontFamily: "var(--)",
							fontSize: 10,
							animation: "case-flash 1s steps(2,end) infinite",
						}}
					>
						?
					</div>
					<div
						style={{
							position: "absolute",
							bottom: 10,
							right: 28,
							color: "#5a4838",
							fontFamily: "var(--)",
							fontSize: 10,
							animation: "case-flash 1s steps(2,end) 0.3s infinite",
						}}
					>
						?
					</div>
					<div
						style={{
							width: 80,
							height: 80,
							position: "relative",
							transformStyle: "preserve-3d",
							animation: "badge-spin 3s linear infinite",
						}}
					>
						{[0, 1, 2, 3, 4].map((layer) => (
							<img
								key={layer}
								src={gym.badgeSprite}
								alt="???"
								width={80}
								height={80}
								style={{
									imageRendering: "pixelated",
									position: "absolute",
									inset: 0,
									transform: `translateZ(${layer * 2}px)`,
									filter: `brightness(0) opacity(${1 - layer * 0.15})`,
								}}
							/>
						))}
					</div>
				</div>

				{/* info */}
				<div
					style={{
						padding: 10,
						display: "flex",
						flexDirection: "column",
						gap: 5,
						textAlign: "center",
						fontFamily: "var(--)",
					}}
				>
					<div
						style={{
							fontSize: 9,
							color: "#a82828",
							animation: "pixel-bounce 1s steps(2,end) infinite",
						}}
					>
						BADGE LOCKED!
					</div>
					<div style={{ fontSize: 7, color: "#686868", lineHeight: 1.8 }}>
						ORDER A DRINK AT
						<br />
						<span style={{ color: "#282828" }}>{gym.name.toUpperCase()}</span>
						<br />
						TO EARN THIS BADGE
					</div>
					<div
						style={{
							fontSize: 7,
							color: "#a8a090",
							marginTop: 2,
						}}
					>
						{gym.requiredDrinks} DRINK{gym.requiredDrinks !== 1 ? "S" : ""}{" "}
						REQUIRED
					</div>
					<button
						type="button"
						onClick={onNavigate}
						style={{
							marginTop: 4,
							fontFamily: "var(--)",
							fontSize: 8,
							padding: "7px 10px",
							border: "3px solid #a82828",
							background: "#d03838",
							color: "#f8f8f8",
							cursor: "pointer",
							boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)",
						}}
					>
						ORDER A DRINK
					</button>
					<button
						type="button"
						onClick={onClose}
						style={{
							fontFamily: "var(--)",
							fontSize: 7,
							padding: "5px 10px",
							border: "2px solid #282828",
							background: "#e8e8e8",
							color: "#282828",
							cursor: "pointer",
						}}
					>
						CLOSE
					</button>
				</div>
			</div>
		</div>
	);
}

// A single badge slot in the 3×3 grid
function GridSlot({
	gym,
	state,
	onClick,
}: {
	gym: Gym;
	state: "cleared" | "active" | "locked";
	onClick: () => void;
}) {
	const isCleared = state === "cleared";
	const isActive = state === "active";
	const isLocked = state === "locked";

	const slotBg = isLocked ? "#383028" : isCleared ? "#d0e8f0" : "#fff8d8";
	const borderColor = isActive ? "#a88820" : "#282828";
	const innerShadow = isActive
		? "inset 2px 2px 0 #fffbe8, inset -2px -2px 0 #c8a838, 2px 2px 0 0 rgba(0,0,0,0.3)"
		: isCleared
			? "inset 2px 2px 0 #f0fcff, inset -2px -2px 0 #a8c0c8, 2px 2px 0 0 rgba(0,0,0,0.3)"
			: "inset 2px 2px 0 #1a1c2c, inset -2px -2px 0 #5a4838, 2px 2px 0 0 rgba(0,0,0,0.3)";

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isLocked}
			style={{
				background: "transparent",
				border: "none",
				padding: 0,
				cursor: isLocked ? "not-allowed" : "pointer",
				position: "relative",
			}}
		>
			<div
				style={{
					aspectRatio: "1 / 1",
					background: slotBg,
					border: `3px solid ${borderColor}`,
					boxShadow: innerShadow,
					position: "relative",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					overflow: "visible",
				}}
			>
				{/* Slot number tag */}
				<div
					style={{
						position: "absolute",
						top: -2,
						left: -2,
						background: "#282828",
						color: "#f0e070",
						fontFamily: "var(--)",
						fontSize: 6,
						padding: "2px 3px",
						border: "2px solid #282828",
						lineHeight: 1,
						zIndex: 2,
					}}
				>
					#{String(gym.id).padStart(2, "0")}
				</div>

				{/* Badge image — silhouette for locked AND active (unearned) */}
				<div
					style={{
						position: "relative",
						filter: isCleared ? "none" : "brightness(0)",
						opacity: isCleared ? 1 : isActive ? 0.6 : 0.4,
					}}
				>
					<img
						src={gym.badgeSprite}
						alt={isCleared ? gym.badgeName : "???"}
						width={36}
						height={36}
						style={{ imageRendering: "pixelated", display: "block" }}
					/>
				</div>

				{/* Pokéball orbit for cleared slots */}
				{isCleared && gym.requiredDrinks > 0 && (
					<div
						style={{
							position: "absolute",
							left: "50%",
							top: "50%",
							width: 0,
							height: 0,
						}}
					>
						<PokeballOrbit count={gym.requiredDrinks} radius={28} />
					</div>
				)}

				{/* Active pulsing dashed ring */}
				{isActive && (
					<div
						style={{
							position: "absolute",
							inset: -2,
							border: "3px dashed #d03838",
							animation: "case-flash 0.6s steps(2,end) infinite",
							pointerEvents: "none",
						}}
					/>
				)}

				{/* Cleared checkmark */}
				{isCleared && (
					<div
						style={{
							position: "absolute",
							top: -4,
							right: -4,
							background: "#50b058",
							color: "#fff",
							border: "2px solid #282828",
							width: 14,
							height: 14,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontFamily: "var(--)",
							fontSize: 7,
							zIndex: 2,
						}}
					>
						✓
					</div>
				)}

				{/* Locked scanline overlay */}
				{isLocked && (
					<div
						style={{
							position: "absolute",
							inset: 0,
							backgroundImage:
								"repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 2px, transparent 2px 4px)",
							pointerEvents: "none",
						}}
					/>
				)}
			</div>

			{/* Short gym name label */}
			<div
				style={{
					marginTop: 3,
					fontFamily: "var(--)",
					fontSize: 5,
					color: isLocked ? "#5a4838" : "#282828",
					textAlign: "center",
					lineHeight: 1.3,
					textShadow: isLocked ? "none" : "1px 1px 0 rgba(255,255,255,0.5)",
					maxWidth: "100%",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{isLocked ? "???" : gym.name.toUpperCase()}
			</div>
		</button>
	);
}

// Grand Pub League slot at the bottom
function LeagueSlot({ unlocked }: { unlocked: boolean }) {
	return (
		<div
			style={{
				background: unlocked ? "#f8d030" : "#5a4838",
				border: `4px solid ${unlocked ? "#a88820" : "#282828"}`,
				boxShadow: unlocked
					? "inset 2px 2px 0 #fff8b0, inset -2px -2px 0 #a88820, 3px 3px 0 0 rgba(0,0,0,0.5)"
					: "3px 3px 0 0 rgba(0,0,0,0.4)",
				padding: "8px 10px",
				display: "flex",
				alignItems: "center",
				gap: 10,
			}}
		>
			{/* Star burst */}
			<div
				style={{
					width: 36,
					height: 36,
					flexShrink: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<svg
					viewBox="0 0 12 12"
					width={32}
					height={32}
					shapeRendering="crispEdges"
				>
					<polygon
						points="6,1 7.2,4.6 11,4.8 8,7.2 9,11 6,9.2 3,11 4,7.2 1,4.8 4.8,4.6"
						fill={unlocked ? "#f8d858" : "#a8b0b8"}
						stroke="#282828"
						strokeWidth="0.8"
					/>
				</svg>
			</div>
			<div
				style={{
					flex: 1,
					fontFamily: "var(--)",
					color: unlocked ? "#282828" : "#d8d0c0",
				}}
			>
				<div style={{ fontSize: 9, lineHeight: 1.4 }}>
					{MASTER_TOURNAMENT.name.toUpperCase()}
				</div>
				<div
					style={{
						fontSize: 7,
						marginTop: 3,
						color: unlocked ? "#a88820" : "#a8a090",
					}}
				>
					{unlocked ? "▶ ENTER THE HALL" : "ALL 9 BADGES NEEDED"}
				</div>
			</div>
			{unlocked && (
				<span
					style={{
						fontFamily: "var(--)",
						fontSize: 12,
						color: "#a82828",
						animation: "cursor-blink 0.8s step-end infinite",
					}}
				>
					▶
				</span>
			)}
		</div>
	);
}

/** Pubdex Grid — Variant D badge case, replaces the old winding trail */
export function GymTrailInline({
	currentGymId,
	badges,
	onSelectGym,
	onClose,
}: GymTrailProps) {
	const [modalGym, setModalGym] = useState<Gym | null>(null);
	const [modalType, setModalType] = useState<"earned" | "unearned">("earned");

	const allBadges = badges.size >= GYMS.length;
	const clearedCount = badges.size;

	const stateOf = (gym: Gym): "cleared" | "active" | "locked" => {
		if (badges.has(gym.id)) return "cleared";
		if (gym.id === currentGymId) return "active";
		return "locked";
	};

	const nextGym = GYMS.find((g) => g.id === currentGymId);

	return (
		<div
			style={{
				background: "#a82828",
				padding: "10px 12px",
				display: "flex",
				flexDirection: "column",
				gap: 8,
				overflowY: "auto",
				height: "100%",
				position: "relative",
			}}
		>
			{/* Pokédex-style chrome header */}
			<div
				style={{
					background: "#d03838",
					border: "3px solid #282828",
					boxShadow:
						"inset 2px 2px 0 rgba(248,88,88,0.6), inset -2px -2px 0 rgba(168,40,40,0.8)",
					padding: "6px 8px",
					display: "flex",
					alignItems: "center",
					gap: 8,
					fontFamily: "var(--)",
					color: "#f8f8f8",
					fontSize: 8,
					flexShrink: 0,
				}}
			>
				{/* Lens */}
				<div
					style={{
						width: 18,
						height: 18,
						borderRadius: "50%",
						background:
							"radial-gradient(circle at 30% 30%, #a8d8f0 0%, #4878d0 50%, #1a3070 100%)",
						border: "2px solid #282828",
						flexShrink: 0,
					}}
				/>
				{/* Indicator dots */}
				<div style={{ display: "flex", gap: 3 }}>
					<div
						style={{
							width: 6,
							height: 6,
							background: "#d03838",
							border: "1px solid #282828",
						}}
					/>
					<div
						style={{
							width: 6,
							height: 6,
							background: "#f8d030",
							border: "1px solid #282828",
						}}
					/>
					<div
						style={{
							width: 6,
							height: 6,
							background: "#50b058",
							border: "1px solid #282828",
						}}
					/>
				</div>
				<div style={{ flex: 1, textAlign: "right" }}>
					BADGES {clearedCount}/{GYMS.length}
				</div>
			</div>

			{/* 3×3 badge grid */}
			<div
				style={{
					background: "#f8f8f8",
					border: "3px solid #282828",
					boxShadow: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8",
					padding: 6,
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: 6,
					flexShrink: 0,
				}}
			>
				{GYMS.map((gym) => {
					const s = stateOf(gym);
					return (
						<GridSlot
							key={gym.id}
							gym={gym}
							state={s}
							onClick={() => {
								if (s === "locked") return;
								if (s === "cleared") {
									setModalType("earned");
									setModalGym(gym);
								} else {
									// active gym — show unearned modal
									setModalType("unearned");
									setModalGym(gym);
								}
							}}
						/>
					);
				})}
			</div>

			{/* Grand Pub League slot */}
			<LeagueSlot unlocked={allBadges} />

			{/* Status bar */}
			<div
				style={{
					background: "#101828",
					border: "2px solid #282828",
					padding: "5px 8px",
					display: "flex",
					justifyContent: "space-between",
					fontFamily: "var(--)",
					fontSize: 7,
					color: "#78b8f0",
					flexShrink: 0,
				}}
			>
				<span>NEXT: {nextGym?.name.toUpperCase() ?? "—"}</span>
				<span style={{ color: "#f0e070" }}>
					★ {clearedCount}/{GYMS.length}
				</span>
			</div>

			{/* Badge modal overlay — positioned relative to the scroll container */}
			{modalGym && modalType === "earned" && (
				<BadgeModal
					gym={modalGym}
					onClose={() => setModalGym(null)}
					onNavigate={() => {
						onSelectGym(modalGym.id);
						setModalGym(null);
						onClose();
					}}
				/>
			)}
			{modalGym && modalType === "unearned" && (
				<UnearnedBadgeModal
					gym={modalGym}
					onClose={() => setModalGym(null)}
					onNavigate={() => {
						onSelectGym(modalGym.id);
						setModalGym(null);
						onClose();
					}}
				/>
			)}
		</div>
	);
}
