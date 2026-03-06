"use client";

import { useState } from "react";
import Image from "next/image";
import {
	getTrainerSpritePath,
	getFallbackTrainerSprite,
} from "@/lib/trainer-sprites";

interface TrainerSpriteProps {
	sprite: string;
	gender?: "boy" | "girl";
	size?: number;
	className?: string;
	flipped?: boolean;
	animated?: boolean;
}

export function TrainerSprite({
	sprite,
	gender = "boy",
	size = 32,
	className = "",
	flipped = false,
	animated = false,
}: TrainerSpriteProps) {
	const [imgError, setImgError] = useState(false);

	// Get sprite path (tries custom sprite first)
	const spritePath = getTrainerSpritePath(sprite.toLowerCase());

	// Fallback to red or lyra based on gender
	const fallbackPath = getTrainerSpritePath(getFallbackTrainerSprite(gender));

	return (
		<div
			className={className}
			style={{
				width: size,
				height: size * 1.5, // Trainer sprites are typically 32x48
				animation: animated ? "pixel-bounce 0.5s step-end infinite" : undefined,
			}}
		>
			<img
				src={imgError ? fallbackPath : spritePath}
				alt={`Trainer ${sprite}`}
				style={{
					width: "100%",
					height: "100%",
					imageRendering: "pixelated",
					objectFit: "contain",
					transform: flipped ? "scaleX(-1)" : undefined,
				}}
				onError={() => {
					if (!imgError) {
						console.log(`Trainer sprite not found: ${sprite}, using fallback`);
						setImgError(true);
					}
				}}
			/>
		</div>
	);
}
