"use client";

import React, { useState } from "react";
import { GYMS } from "@/lib/gym-data";
import { createPubGymFromGyms } from "@/lib/pub-crawl-data";
import PubCrawlPath from "./PubCrawlPath";
import { PixelBox } from "./pixel-box";

interface CollapsibleGymPathProps {
	currentGymId: number;
	badges: Set<number>;
	onSelectGym: (gymId: number) => void;
}

export function CollapsibleGymPath({
	currentGymId,
	badges = new Set(),
	onSelectGym,
}: CollapsibleGymPathProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	const currentGym = GYMS.find((g) => g.id === currentGymId) || GYMS[0]!;
	const pubGymData = createPubGymFromGyms(GYMS, badges);

	return (
		<div className="w-full">
			{/* Collapsible banner */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full cursor-pointer font-sans group"
			>
				<PixelBox variant="battle">
					<div className="flex items-center gap-3">
						{/* Current gym badge */}
						<div
							className="w-10 h-10 border-2 flex items-center justify-center shrink-0"
							style={{
								borderColor: currentGym.badgeColor,
								background: badges.has(currentGymId)
									? `${currentGym.badgeColor}22`
									: "transparent",
							}}
						>
							{badges.has(currentGymId) ? (
								<span className="text-[16px] text-foreground">★</span>
							) : (
								<span className="text-[16px] text-muted-foreground">☆</span>
							)}
						</div>

						{/* Info */}
						<div className="flex-1 text-left">
							<div className="flex items-center gap-2">
								<span className="text-[8px] text-primary bg-primary/10 px-1.5 py-0.5 border border-primary/20">
									GYM {currentGym.id}
								</span>
								{badges.has(currentGymId) && (
									<span className="text-[7px] text-primary">BADGE EARNED</span>
								)}
							</div>
							<p className="text-[10px] text-foreground mt-1">
								{currentGym.name}
							</p>
							<p className="text-[8px] text-muted-foreground">
								{currentGym.subtitle}
							</p>
						</div>

						{/* Expand/collapse indicator */}
						<div className="text-muted-foreground text-[12px] group-hover:text-primary transition-colors">
							{isExpanded ? "▼" : "▶"}
						</div>
					</div>
				</PixelBox>
			</button>

			{/* Expandable path */}
			{isExpanded && (
				<div className="mt-4">
					<PixelBox>
						<div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
							<PubCrawlPath
								pubs={pubGymData}
								onSelect={(id) => {
									onSelectGym(id);
									setIsExpanded(false);
								}}
								currentId={currentGymId}
							/>
						</div>
					</PixelBox>
				</div>
			)}
		</div>
	);
}
