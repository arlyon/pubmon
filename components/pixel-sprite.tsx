"use client";

import { useState } from "react";
import type { PubType } from "@/lib/pokemon-data";
import { getMissingnoSprite, getPubMonSprite } from "@/lib/pokemon-data";

interface PixelSpriteProps {
	name: string;
	size?: number;
	className?: string;
	flipped?: boolean;
	animated?: boolean;
	variant?: number;
}

export function PixelSprite({
	name,
	size = 6,
	className = "",
	flipped = false,
	animated = false,
	variant = 1,
}: PixelSpriteProps) {
	const [imgError, setImgError] = useState(false);
	const spriteKey = name.toLowerCase();

	// Try to get the sprite path, fallback to Missingno if error
	const spritePath = imgError
		? getMissingnoSprite()
		: getPubMonSprite(spriteKey, variant);

	const offset = 0.5 * (size % 7);

	return (
		<div
			className={`${className}`}
			style={{
				width: size,
				height: size,
				animation: animated
					? `pixel-bounce 1s steps(2, end) ${offset}s infinite`
					: undefined,
			}}
		>
			<img
				src={spritePath}
				alt={name}
				onError={() => {
					console.error("Failed to load sprite", spritePath);
					setImgError(true);
				}}
				style={{
					width: "100%",
					height: "100%",
					imageRendering: "pixelated",
					objectFit: "contain",
					transform: flipped ? "scaleX(-1)" : undefined,
				}}
			/>
		</div>
	);
}

export function TypeBadge({ type }: { type: PubType }) {
	const info = {
		beer: { label: "BEER", element: "EARTH", bg: "bg-type-beer" },
		shot: { label: "SHOT", element: "FIRE", bg: "bg-type-shot" },
		wine: { label: "WINE", element: "FAIRY", bg: "bg-type-wine" },
		water: { label: "WATER", element: "WATER", bg: "bg-type-water" },
		cocktail: { label: "CKTL", element: "GRASS", bg: "bg-type-cocktail" },
	}[type];

	return (
		<span
			className={`inline-block px-1 py-0.5 text-gba-[9] font-sans ${info.bg} text-background`}
		>
			{info.label}
		</span>
	);
}
