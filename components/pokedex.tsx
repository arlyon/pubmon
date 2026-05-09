"use client";

import { useState } from "react";
import { usePokemonCry } from "@/hooks/use-pokemon-cry";
import { ALL_PUBMON, type PubType, TYPE_INFO } from "@/lib/pokemon-data";
import PixelBox from "./pixel/PixelBox";
import { PixelSprite, TypeBadge } from "./pixel-sprite";
import { PubMonDetailPanel } from "./pubmon-detail";

interface PokedexProps {
	seenIds: Set<number>;
	caughtIds: Set<number>;
	onBack: () => void;
}

const TYPE_ORDER: PubType[] = ["beer", "shot", "wine", "water", "cocktail"];

function PubBallIcon({
	caught,
	className = "",
}: {
	caught: boolean;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 10 10"
			className={`pixel-perfect ${className}`}
			style={{ width: "100%", height: "100%" }}
		>
			<circle
				cx={5}
				cy={5}
				r={4.5}
				fill={caught ? "rgb(var(--pixel-red))" : "rgb(var(--pixel-gray))"}
			/>
			<rect
				x={0.5}
				y={4.5}
				width={9}
				height={1}
				fill="rgb(var(--pixel-black))"
			/>
			<circle
				cx={5}
				cy={5}
				r={4.5}
				fill="none"
				stroke="rgb(var(--pixel-black))"
				strokeWidth={0.5}
			/>
			<rect
				x={0.5}
				y={5}
				width={9}
				height={4.5}
				rx={4.5}
				fill={caught ? "rgb(var(--pixel-white))" : "rgb(var(--pixel-gray))"}
			/>
			<circle
				cx={5}
				cy={5}
				r={1.2}
				fill={caught ? "rgb(var(--pixel-white))" : "rgb(var(--pixel-gray))"}
				stroke="rgb(var(--pixel-black))"
				strokeWidth={0.4}
			/>
			<circle cx={5} cy={5} r={0.6} fill="rgb(var(--pixel-black))" />
		</svg>
	);
}

export function Pokedex({ seenIds, caughtIds }: PokedexProps) {
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [filterType, setFilterType] = useState<PubType | "all">("all");
	const { playPokemonCry } = usePokemonCry(ALL_PUBMON);

	// Set to true to unlock all pokemon (see and catch all)
	const allUnlocked = false;

	const filteredPubMon =
		filterType === "all"
			? ALL_PUBMON
			: ALL_PUBMON.filter((p) => p.type === filterType);

	const selected =
		selectedId !== null ? ALL_PUBMON.find((p) => p.id === selectedId) : null;
	const isSeen = selected ? allUnlocked || seenIds.has(selected.id) : false;
	const isCaught = selected ? allUnlocked || caughtIds.has(selected.id) : false;

	const totalSeen = allUnlocked ? ALL_PUBMON.length : seenIds.size;
	const totalCaught = allUnlocked ? ALL_PUBMON.length : caughtIds.size;
	const totalPubMon = ALL_PUBMON.length;

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			{/* Header */}
			<div className="bg-pixel-red px-gba-[8] py-gba-[6] border-b border-pixel-black flex justify-between items-center font-pixel">
				<div>
					<div className="text-gba-[9] text-pixel-white">PUBDEX</div>
					<div className="text-gba-[6] mt-gba-[2]" style={{ color: "#f8d8d8" }}>
						PUBMON DIRECTORY
					</div>
				</div>
				<div className="bg-pixel-black px-gba-[6] py-gba-[3] text-gba-[7] text-pixel-yellow border border-pixel-white font-pixel">
					{totalCaught}/{totalPubMon}
				</div>
			</div>

			{/* Type filter tabs */}
			<div className="flex gap-gba-[2] flex-wrap my-gba-[4]">
				<button
					type="button"
					onClick={() => setFilterType("all")}
					className={`px-gba-[4] py-gba-[2] font-pixel text-gba-[6] border-gba-[2] cursor-pointer transition-colors ${
						filterType === "all"
							? "border-pixel-black bg-pixel-white text-pixel-black"
							: "border-pixel-gray bg-pixel-gray-light text-pixel-gray"
					}`}
				>
					ALL
				</button>
				{TYPE_ORDER.map((type) => {
					const info = TYPE_INFO[type];
					return (
						<button
							key={type}
							type="button"
							onClick={() => setFilterType(type)}
							className={`px-gba-[4] py-gba-[2] font-pixel text-gba-[6] border-gba-[2] cursor-pointer transition-colors
                ${
									filterType === type
										? "text-pixel-white"
										: "border-pixel-gray bg-pixel-gray-light text-pixel-gray"
								}`}
							style={
								filterType === type
									? {
											borderColor: "rgb(var(--pixel-black))",
											backgroundColor: info.color,
										}
									: undefined
							}
						>
							{info.label.toUpperCase()}
						</button>
					);
				})}
			</div>

			{/* Pokemon grid */}
			<div className="mb-gba-[4] flex-1 min-h-gba-[120]">
				<PixelBox className="h-full flex flex-col">
					<div className="overflow-y-auto pixel-scroll flex-1">
						<div className="grid grid-cols-4 gap-gba-[2] p-gba-[2]">
							{filteredPubMon.map((mon) => {
								const seen = allUnlocked || seenIds.has(mon.id);
								const caught = allUnlocked || caughtIds.has(mon.id);
								const isSelected = selectedId === mon.id;
								const typeInfo = TYPE_INFO[mon.type];

								return (
									<button
										key={mon.id}
										type="button"
										onClick={() => setSelectedId(isSelected ? null : mon.id)}
										className={`
                    relative flex flex-col items-center gap-gba-[1] p-gba-[2] border-gba-[2] cursor-pointer transition-all font-pixel
                    ${
											isSelected
												? "border-pixel-black bg-pixel-yellow/50"
												: seen
													? "border-pixel-gray bg-pixel-gray-light hover:border-pixel-black"
													: "border-pixel-gray-light bg-pixel-white"
										}
                  `}
									>
										{/* Number */}
										<span className="text-gba-[5] text-pixel-gray self-start">
											#{String(mon.id).padStart(3, "0")}
										</span>

										{/* Sprite or silhouette */}
										<div className="size-gba-[32] flex items-center justify-center">
											{seen ? (
												<div
													className="opacity-100"
													style={{
														filter: caught
															? "none"
															: "grayscale(100%) opacity(70%)",
													}}
												>
													<PixelSprite
														name={mon.sprite}
														size={32}
														variant={mon.spriteVariant}
													/>
												</div>
											) : (
												<div className="size-gba-[24] flex items-center justify-center">
													<span className="text-gba-[12] font-sans font-palette-muted">
														?
													</span>
												</div>
											)}
										</div>

										{/* Name */}
										<span
											className={`text-gba-[4] truncate w-full text-center ${seen ? "text-pixel-black" : "text-pixel-gray"}`}
										>
											{seen ? mon.name.toUpperCase() : "???"}
										</span>

										{/* Caught indicator */}
										{caught && (
											<div
												className="absolute size-gba-[5]"
												style={{
													top: "calc(1px * var(--pixel-scale, 1))",
													right: "calc(1px * var(--pixel-scale, 1))",
												}}
											>
												<PubBallIcon caught />
											</div>
										)}

										{/* Type color bar at bottom */}
										{seen && (
											<div
												className="absolute bottom-0 left-0 right-0 h-gba-[2]"
												style={{ backgroundColor: typeInfo.color }}
											/>
										)}
									</button>
								);
							})}
						</div>
					</div>
				</PixelBox>
			</div>

			{/* Detail panel */}
			{selected && isSeen && (
				<div className="mb-gba-[4]">
					<PubMonDetailPanel
						mon={selected}
						onCry={() => playPokemonCry(selected.id)}
						stats={isCaught ? [
							{ label: "HP", value: selected.maxHp },
							{ label: "ATK", value: selected.attack },
							{ label: "DEF", value: selected.defense },
							{ label: "LVL", value: selected.level },
						] : undefined}
					>
						<div className="flex items-center gap-gba-[4] mt-gba-[2]">
							{isCaught ? (
								<div className="flex items-center gap-gba-[2]">
									<div className="size-gba-[6]">
										<PubBallIcon caught />
									</div>
									<span className="font-sans font-palette-yellow text-gba-[5]">
										CAUGHT
									</span>
								</div>
							) : (
								<span className="font-sans font-palette-muted text-gba-[5]">
									NOT CAUGHT
								</span>
							)}
						</div>
						{isCaught && (
							<p className="font-sans font-palette-blue text-gba-[5] leading-tight mt-gba-[2]">
								{selected.description}
							</p>
						)}
					</PubMonDetailPanel>
				</div>
			)}

			{/* Detail panel for unseen */}
			{selected && !isSeen && (
				<div className="mb-gba-[4]">
					<PixelBox>
						<div className="flex gap-gba-[4]">
							{/* Silhouette sprite */}
							<div className="size-gba-[48] flex items-center justify-center shrink-0 bg-pixel-gray-light border-gba-[2] border-pixel-gray">
								<div style={{ filter: "grayscale(100%) brightness(0) opacity(50%)" }}>
									<PixelSprite
										name={selected.sprite}
										size={64}
										variant={selected.spriteVariant}
									/>
								</div>
							</div>

							{/* Info */}
							<div className="flex flex-col gap-gba-[2] justify-center">
								<span className="font-pixel text-gba-[6] text-pixel-gray">
									#{String(selected.id).padStart(3, "0")} ???
								</span>
								<p className="font-pixel text-gba-[5] text-pixel-gray">
									NOT YET ENCOUNTERED
								</p>
								<p className="font-pixel text-gba-[5] text-pixel-gray leading-tight mt-gba-[2]">
									ORDER A DRINK OF THE
									<br />
									RIGHT TYPE TO FIND!
								</p>
							</div>
						</div>
					</PixelBox>
				</div>
			)}
		</div>
	);
}
