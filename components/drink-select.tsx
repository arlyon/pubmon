"use client";

import { useState } from "react";
import type { PubType } from "@/lib/pokemon-data";
import { CollapsibleGymPath } from "./CollapsibleGymPath";
import { PixelBox, PixelButton } from "./pixel-box";

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
}

export function DrinkSelect({
	onSelect,
	drinksCollected,
	currentGymId,
	badges,
	onSelectGym,
}: DrinkSelectProps) {
	const [selectedIdx, setSelectedIdx] = useState(0);
	const selected = DRINK_TYPES[selectedIdx];

	return (
		<div className="flex flex-1 flex-col w-full max-w-md mx-auto">
			{/* Gym Progress */}
			<CollapsibleGymPath
				className="px-2"
				currentGymId={currentGymId}
				badges={badges}
				onSelectGym={onSelectGym}
			/>
			<div className="flex-1 overflow-y-scroll py-4 px-2">
				{/* Header */}
				<PixelBox variant="battle">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-[10px] text-muted-foreground">PUB CRAWL</p>
							<p className="text-[14px] text-primary mt-1">Add a Drink</p>
						</div>
						<div className="text-right">
							<p className="text-[8px] text-muted-foreground">DRINKS</p>
							<p className="text-[16px] text-primary">{drinksCollected}</p>
						</div>
					</div>
				</PixelBox>

				{/* Drink type grid */}
				<PixelBox>
					<p className="text-[8px] text-muted-foreground mb-3">
						SELECT DRINK TYPE
					</p>
					<div className="flex flex-col gap-2">
						{DRINK_TYPES.map((drink, idx) => (
							<button
								key={drink.type}
								onClick={() => setSelectedIdx(idx)}
								className={`
                flex items-center gap-3 p-2 border-2 cursor-pointer
                transition-all font-sans text-left
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
								<div className="flex-1">
									<p className="text-[10px] text-foreground">{drink.label}</p>
									<p className="text-[8px] text-muted-foreground">
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

				{/* Action button */}
				<div className="flex justify-center">
					<PixelButton
						variant="primary"
						onClick={() => onSelect(selected.type)}
						className="w-full text-[12px] py-3"
					>
						ORDER {selected.label}
					</PixelButton>
				</div>
			</div>
		</div>
	);
}
