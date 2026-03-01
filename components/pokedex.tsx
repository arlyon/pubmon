"use client";

import { useState } from "react";
import { usePokemonCry } from "@/hooks/use-pokemon-cry";
import { ALL_PUBMON, type PubType, TYPE_INFO } from "@/lib/pokemon-data";
import PixelBox from "./pixel/PixelBox";
import PixelHeader from "./pixel/PixelHeader";
import PixelMenu from "./pixel/PixelMenu";
import { PixelSprite, TypeBadge } from "./pixel-sprite";

interface PokedexProps {
	seenIds: Set<number>;
	caughtIds: Set<number>;
	onBack: () => void;
}

const TYPE_ORDER: PubType[] = ["beer", "shot", "wine", "water", "cocktail"];

function PubBallIcon({
	caught,
	size = 12,
}: {
	caught: boolean;
	size?: number;
}) {
	return (
		<svg
			viewBox="0 0 10 10"
			width={size}
			height={size}
			className="pixel-perfect"
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

export function Pokedex({ seenIds, caughtIds, onBack }: PokedexProps) {
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [filterType, setFilterType] = useState<PubType | "all">("all");
	const { playPokemonCry } = usePokemonCry(ALL_PUBMON);

	const filteredPubMon =
		filterType === "all"
			? ALL_PUBMON
			: ALL_PUBMON.filter((p) => p.type === filterType);

	const selected =
		selectedId !== null ? ALL_PUBMON.find((p) => p.id === selectedId) : null;
	const isSeen = selected ? seenIds.has(selected.id) : false;
	const isCaught = selected ? caughtIds.has(selected.id) : false;

	const totalSeen = seenIds.size;
	const totalCaught = caughtIds.size;
	const totalPubMon = ALL_PUBMON.length;

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			{/* Header */}
			<div
				style={{
					background: "#f85858",
					padding: "6px 8px",
					borderBottom: "1px solid #181010",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					fontFamily: "'Press Start 2P', monospace",
				}}
			>
				<div>
					<div style={{ fontSize: 9, color: "#f8f8f8" }}>PUBDEX</div>
					<div style={{ fontSize: 6, color: "#f8d8d8", marginTop: 2 }}>
						PUBMON DIRECTORY
					</div>
				</div>
				<div
					style={{
						background: "#181010",
						padding: "3px 6px",
						fontSize: 7,
						color: "#f8b830",
						border: "1px solid #f8f8f8",
					}}
				>
					{totalCaught}/{totalPubMon}
				</div>
			</div>

			{/* Type filter tabs */}
			<div className="flex gap-[2px] flex-wrap my-1">
				<button
					type="button"
					onClick={() => setFilterType("all")}
					className={`px-[4px] py-[2px] font-pixel text-[6px] border-2 cursor-pointer transition-colors ${
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
							className={`px-[4px] py-[2px] font-pixel text-[6px] border-2 cursor-pointer transition-colors
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
			<div className="mb-[4px] flex-1 h-[150px]">
				<PixelBox className="h-full flex flex-col">
					<div className="overflow-y-auto pixel-scroll flex-1">
						<div className="grid grid-cols-4 gap-[2px] p-[2px]">
							{filteredPubMon.map((mon) => {
								const seen = seenIds.has(mon.id);
								const caught = caughtIds.has(mon.id);
								const isSelected = selectedId === mon.id;
								const typeInfo = TYPE_INFO[mon.type];

								return (
									<button
										key={mon.id}
										type="button"
										onClick={() => setSelectedId(isSelected ? null : mon.id)}
										className={`
                    relative flex flex-col items-center gap-[1px] p-[2px] border-2 cursor-pointer transition-all font-pixel
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
										<span className="text-[5px] text-pixel-gray self-start">
											#{String(mon.id).padStart(3, "0")}
										</span>

										{/* Sprite or silhouette */}
										<div className="w-[32px] h-[32px] flex items-center justify-center">
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
												<div className="w-[24px] h-[24px] flex items-center justify-center">
													<span className="text-[12px] text-pixel-gray font-sans">
														?
													</span>
												</div>
											)}
										</div>

										{/* Name */}
										<span
											className={`text-[4px] truncate w-full text-center ${seen ? "text-pixel-black" : "text-pixel-gray"}`}
										>
											{seen ? mon.name.toUpperCase() : "???"}
										</span>

										{/* Caught indicator */}
										{caught && (
											<div className="absolute top-[1px] right-[1px]">
												<PubBallIcon caught size={5} />
											</div>
										)}

										{/* Type color bar at bottom */}
										{seen && (
											<div
												className="absolute bottom-0 left-0 right-0 h-[2px]"
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
				<div className="mb-[4px]">
					<PixelBox variant="blue">
						<div className="flex gap-[4px] relative">
							{/* Sprite */}
							<div
								className="w-[48px] h-[48px] border-2 flex items-center justify-center shrink-0"
								style={{
									borderColor: "rgb(var(--pixel-white))",
									background: TYPE_INFO[selected.type].color,
								}}
							>
								<PixelSprite
									name={selected.sprite}
									size={64}
									animated
									variant={selected.spriteVariant}
								/>
							</div>

							{/* Info */}
							<div className="flex flex-col gap-[2px] flex-1 min-w-0">
								<div className="flex items-center gap-[4px]">
									<span className="font-pixel text-[6px] text-pixel-white">
										#{String(selected.id).padStart(3, "0")}
									</span>
									<h3 className="font-pixel text-[8px] text-pixel-white m-0">
										{selected.name.toUpperCase()}
									</h3>
									<button
										type="button"
										onClick={() => playPokemonCry(selected.id)}
										className={`ml-auto px-[4px] py-[2px] font-pixel text-[6px] border-2 cursor-pointer transition-colors`}
										title="Play cry"
									>
										🔊
									</button>
								</div>

								<div className="flex items-center gap-[4px] mt-[2px]">
									<TypeBadge type={selected.type} />
									<span className="font-pixel text-[5px] text-pixel-white">
										{TYPE_INFO[selected.type].element.toUpperCase()}
									</span>
								</div>

								{/* Status */}
								<div className="flex items-center gap-[4px] mt-[2px]">
									{isCaught ? (
										<div className="flex items-center gap-[2px]">
											<PubBallIcon caught size={6} />
											<span className="font-pixel text-[5px] text-pixel-yellow">
												CAUGHT
											</span>
										</div>
									) : (
										<span className="font-pixel text-[5px] text-pixel-gray-light">
											NOT CAUGHT
										</span>
									)}
								</div>

								{/* Description - only if caught */}
								{isCaught && (
									<p className="font-pixel text-[5px] text-pixel-white leading-tight mt-[2px]">
										{selected.description}
									</p>
								)}
							</div>
						</div>

						{/* Stats - only if caught */}
						{isCaught && (
							<div className="mt-[4px] pt-[4px] border-t-2 border-pixel-white/30">
								<div className="grid grid-cols-4 gap-[2px]">
									<div className="flex flex-col items-center">
										<span className="font-pixel text-[5px] text-pixel-gray-light">
											HP
										</span>
										<span className="font-pixel text-[6px] text-pixel-white">
											{selected.maxHp}
										</span>
									</div>
									<div className="flex flex-col items-center">
										<span className="font-pixel text-[5px] text-pixel-gray-light">
											ATK
										</span>
										<span className="font-pixel text-[6px] text-pixel-white">
											{selected.attack}
										</span>
									</div>
									<div className="flex flex-col items-center">
										<span className="font-pixel text-[5px] text-pixel-gray-light">
											DEF
										</span>
										<span className="font-pixel text-[6px] text-pixel-white">
											{selected.defense}
										</span>
									</div>
									<div className="flex flex-col items-center">
										<span className="font-pixel text-[5px] text-pixel-gray-light">
											LVL
										</span>
										<span className="font-pixel text-[6px] text-pixel-white">
											{selected.level}
										</span>
									</div>
								</div>

								{/* Moves */}
								<div className="mt-[4px]">
									<span className="font-pixel text-[5px] text-pixel-gray-light mb-[2px] block">
										MOVES
									</span>
									<div className="grid grid-cols-2 gap-[2px]">
										{selected.moves.map((move) => (
											<div
												key={move}
												className="bg-pixel-blue-dark border border-pixel-white/50 px-[2px] py-[2px] font-pixel text-[5px] text-pixel-white text-center"
											>
												{move.toUpperCase()}
											</div>
										))}
									</div>
								</div>
							</div>
						)}
					</PixelBox>
				</div>
			)}

			{/* Detail panel for unseen */}
			{selected && !isSeen && (
				<div className="mb-[4px]">
					<PixelBox>
						<div className="flex flex-col items-center gap-[2px] py-[8px]">
							<span className="font-pixel text-[6px] text-pixel-gray">
								#{String(selected.id).padStart(3, "0")}
							</span>
							<span className="font-sans text-[16px] text-pixel-gray opacity-50">
								?
							</span>
							<p className="font-pixel text-[6px] text-pixel-gray">
								NOT YET ENCOUNTERED
							</p>
							<p className="font-pixel text-[5px] text-pixel-gray leading-tight text-center mt-[2px]">
								ORDER A DRINK OF THE RIGHT TYPE
								<br />
								TO ENCOUNTER THIS PUBMON!
							</p>
						</div>
					</PixelBox>
				</div>
			)}
		</div>
	);
}
