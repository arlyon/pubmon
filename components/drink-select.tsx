"use client";

import { useState } from "react";
import type { PubMon, PubType } from "@/lib/pokemon-data";
import { cn } from "@/lib/utils";
import { GymHeader } from "./GymHeader";
import PixelScrollWrapper from "./pixel/PixelScrollWrapper";
import { PixelBox, PixelButton } from "./pixel-box";
import { TrainerSprite } from "./trainer-sprite";

const DRINK_TYPES: {
	type: PubType;
	label: string;
	element: string;
	icon: string[];
	color: string;
}[] = [
	{
		type: "beer",
		label: "BEER",
		element: "Earth Type",
		color: "#c28b4a",
		icon: [
			"..####..",
			"..#..#..",
			".######.",
			".#.aa.#.",
			".#.aa.#.",
			".#.aa.#.",
			".#....#.",
			".######.",
		],
	},
	{
		type: "shot",
		label: "SHOT",
		element: "Fire Type",
		color: "#e43b44",
		icon: [
			"...##...",
			"..####..",
			".##..##.",
			".#.aa.#.",
			".#.aa.#.",
			"..#..#..",
			"..#..#..",
			"..####..",
		],
	},
	{
		type: "wine",
		label: "WINE",
		element: "Fairy Type",
		color: "#f4a4c0",
		icon: [
			"..####..",
			".#.aa.#.",
			".#.aa.#.",
			"..#..#..",
			"...##...",
			"...##...",
			"...##...",
			"..####..",
		],
	},
	{
		type: "water",
		label: "WATER",
		element: "Water Type",
		color: "#63c6e1",
		icon: [
			"...##...",
			"..####..",
			".##..##.",
			".#.aa.#.",
			".#.aa.#.",
			".#.aa.#.",
			".##..##.",
			"..####..",
		],
	},
	{
		type: "cocktail",
		label: "COCKTAIL",
		element: "Grass Type",
		color: "#63c74d",
		icon: [
			"#......#",
			".#.##.#.",
			"..#..#..",
			"..#aa#..",
			"...##...",
			"...##...",
			"...##...",
			"..####..",
		],
	},
];

function DrinkIcon({
	icon,
	color,
	size = 4,
}: {
	icon: string[];
	color: string;
	size?: number;
}) {
	return (
		<svg
			viewBox="0 0 8 8"
			width={size * 8}
			height={size * 8}
			style={{ imageRendering: "pixelated" }}
		>
			{icon.map((row, y) =>
				[...row].map((cell, x) => {
					if (cell === ".") return null;
					const fillColor = cell === "a" ? color : "#f4f4f4";
					return (
						<rect
							key={`${x}-${y}`}
							x={x}
							y={y}
							width={1}
							height={1}
							fill={fillColor}
						/>
					);
				}),
			)}
		</svg>
	);
}

interface DrinkSelectProps {
	onSelect: (type: PubType) => void;
	drinksCollected: number;
	currentGymId: number;
	badges: Set<number>;
	onSelectGym: (gymId: number) => void;
	activePubmon: PubMon | null;
	pokedexSeen: number;
	pokedexTotal: number;
	playerSprite?: string;
	playerName?: string;
	playerGender?: "boy" | "girl";
	gamePhase?: "collection" | "tournament" | "hall-of-fame";
	activeBattleId?: string;
	activeBattleOpponent?: string;
	onJoinBattle?: () => void;
}

export function DrinkSelect({
	onSelect,
	drinksCollected,
	currentGymId,
	badges,
	onSelectGym,
	activePubmon,
	pokedexSeen,
	pokedexTotal,
	playerSprite,
	playerName,
	gamePhase,
	playerGender = "boy",
	activeBattleId,
	activeBattleOpponent,
	onJoinBattle,
}: DrinkSelectProps) {
	const [selectedIdx, setSelectedIdx] = useState(0);
	const selected = DRINK_TYPES[selectedIdx];
	const player = {
		name: playerName,
		totalBattles: drinksCollected,
		earnedBadges: badges.size,
		pokedexSeen,
		pokedexTotal,
		level: activePubmon?.level ?? 1,
	};

	return (
		<div className="flex flex-1 flex-col w-full mx-auto">
			{/* Gym Header */}
			<GymHeader
				currentGymId={currentGymId}
				badges={badges}
				onSelectGym={onSelectGym}
				gamePhase={gamePhase}
				activeBattleId={activeBattleId}
				activeBattleOpponent={activeBattleOpponent}
				onJoinBattle={onJoinBattle}
				className="mb-4"
			/>
			<PixelScrollWrapper className="flex-1 flex flex-col overflow-y-scroll p-2 mt-gba-[70] gap-gba-[2]">
				<PixelBox>
					{/* Card title bar */}
					<div
						className="border-b-2 border-red-900 [font-palette:--emerald-red]"
						style={{
							background: "#f85858",
							padding: "3px 6px",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span style={{ color: "#f8f8f8" }} className="text-gba-[9]">
							TRAINER CARD
						</span>
						<span style={{ color: "#f8f8f8" }} className="text-gba-[9]">
							ID: #0042
						</span>
					</div>

					{/* Main content */}
					<div style={{ padding: "6px", display: "flex", gap: 8 }}>
						{/* Trainer sprite placeholder */}
						<div
							className="border-gba-[1] border-black"
							style={{
								width: 56,
								height: 64,
								background: "#d0e8f0",
								flexShrink: 0,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								position: "relative",
								overflow: "hidden",
							}}
						>
							{/* Pixel trainer art */}
							<TrainerSprite
								sprite={playerSprite ?? playerName ?? playerGender}
								gender={playerGender}
								size={64}
								className="pt-4"
								flipped
							/>
							{/*<div
								className="text-gba-[9] [font-palette:--emerald-blue] leading-none p-gba-[2] text-white"
								style={{
									position: "absolute",
									bottom: 0,

									left: 0,
									right: 0,
									background: "#2038a0",
									textAlign: "center",
									borderTop: "1px solid #181010",
								}}
							>
								LV.{player.level}
							</div>*/}
						</div>

						{/* Stats */}
						<div className="flex flex-1 flex-col gap-1">
							<div className="text-gba-[9] font-heading leading-none">
								{player.name}
							</div>

							<XpBar activePubmon={activePubmon} />

							{/* Stats row */}
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: 4,
									marginTop: 2,
								}}
							>
								<StatBox label="BATTLES" value={player.totalBattles} />
								<StatBox label="BADGES" value={player.earnedBadges} accent />
								<StatBox
									label="PUBDEX"
									value={`${player.pokedexSeen}/${player.pokedexTotal}`}
								/>
								<StatBox label="STATUS" value="OK" color="#38c838" />
							</div>
						</div>
					</div>
				</PixelBox>

				{/* Drink type grid */}
				<PixelBox className="p-2">
					<div className="flex flex-col gap-2">
						{DRINK_TYPES.map((drink, idx) => (
							<button
								key={drink.type}
								onClick={() => setSelectedIdx(idx)}
								className={`
                flex items-center gap-3 p-1 border-2 cursor-pointer
                transition-all font-sans font-palette-default text-left
                ${
									idx === selectedIdx
										? "border-primary bg-secondary"
										: "border-transparent hover:border-muted-foreground/30"
								}
              `}
							>
								<div
									className="flex items-center justify-center w-10 h-10 border-2"
									style={{
										borderColor: drink.color,
										background: `${drink.color}22`,
									}}
								>
									<DrinkIcon icon={drink.icon} color={drink.color} size={4} />
								</div>
								<div className="flex-1 leading-none">
									<p className="text-gba-[9] text-foreground">{drink.label}</p>
									<p className="text-gba-[9] [font-palette:--emerald-muted]">
										{drink.element}
									</p>
								</div>
								{idx === selectedIdx && (
									<div className="text-primary text-[10px] animate-pulse">
										{">"}
									</div>
								)}
							</button>
						))}
					</div>
				</PixelBox>

				{/* Action button — drinks are closed once the crawl phase ends
				    (tournament running or hall of fame reached). */}
				<div className="flex justify-center">
					<PixelButton
						variant="primary"
						disabled={gamePhase !== "collection"}
						onClick={() => onSelect(selected.type)}
						className="w-full text-gba-[9] py-3 [font-palette:--emerald-blue]"
					>
						{gamePhase !== "collection"
							? "BAR CLOSED"
							: `ORDER ${selected.label}`}
					</PixelButton>
				</div>
			</PixelScrollWrapper>
		</div>
	);
}

function StatBox({
	label,
	value,
	accent,
	color,
}: {
	label: string;
	value: string | number;
	accent?: boolean;
	color?: string;
}) {
	return (
		<div
			className="flex justify-between items-center leading-none"
			style={{
				border: "1px solid #181010",
				background: accent ? "#2038a0" : "#c8d8a8",
				padding: "2px 4px",
			}}
		>
			<div
				className={cn(
					"text-gba-[9]",
					accent ? "[font-palette:--emerald-blue]" : null,
				)}
			>
				{label}
			</div>
			<div
				className="text-gba-[6]"
				style={{
					color: color ?? (accent ? "#f8f8f8" : "#181010"),
					fontFamily: "'Press Start 2P', monospace",
				}}
			>
				{value}
			</div>
		</div>
	);
}

function XpBar({ activePubmon }: { activePubmon: PubMon | null }) {
	// Calculate XP percentage (assuming maxXp is level * 100)
	const level = activePubmon?.level ?? 1;
	const xp = activePubmon?.xp ?? 0;
	const maxXp = level * 100;
	const xpPct = (xp / maxXp) * 100;
	const name = activePubmon?.name ?? "No Pubmon";

	return (
		<div>
			<div
				className="text-gba-[9] leading-none mb-gba-[1]"
				style={{
					display: "flex",
					justifyContent: "space-between",
					color: "#383028",
				}}
			>
				<span>{name}</span>
				<span style={{ color: "#2038a0" }}>LV.{level}</span>
			</div>
			<div
				style={{
					height: 4,
					background: "#6870a0",
					border: "1px solid #181010",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						height: "100%",
						width: `${Math.min(100, xpPct)}%`,
						background: "#3878f8",
						transition: "width 0.3s ease",
					}}
				/>
			</div>
		</div>
	);
}
