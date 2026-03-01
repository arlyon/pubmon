"use client";

import { useState } from "react";
import { usePokemonCry } from "@/hooks/use-pokemon-cry";
import { type PubMon, TYPE_INFO } from "@/lib/pokemon-data";
import PixelBox from "./pixel/PixelBox";
import PixelHeader from "./pixel/PixelHeader";
import { PixelButton } from "./pixel-box";
import { PixelSprite, TypeBadge } from "./pixel-sprite";

interface TeamManagementProps {
	team: PubMon[];
	onBack: () => void;
	onSetActive: (index: number) => void;
	activeIndex: number;
}

export function TeamManagement({
	team,
	onBack,
	onSetActive,
	activeIndex,
}: TeamManagementProps) {
	const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
	const selected = selectedIdx !== null ? team[selectedIdx] : null;
	const { playPokemonCry } = usePokemonCry(team);

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			{/* Header */}
			<div
				style={{
					background: "#384080",
					padding: "6px 8px",
					borderBottom: "1px solid #181010",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					fontFamily: "'Press Start 2P', monospace",
				}}
			>
				<div>
					<div style={{ fontSize: 9, color: "#f8f8f8" }}>PUBMON</div>
					<div style={{ fontSize: 6, color: "#a0b8f0", marginTop: 2 }}>
						YOUR PARTY
					</div>
				</div>
				<div style={{ textAlign: "right" }}>
					<div style={{ fontSize: 6, color: "#a0b8f0" }}>SIZE</div>
					<div style={{ fontSize: 10, color: "#f8b830" }}>{team.length}/6</div>
				</div>
			</div>

			{/* Party list */}
			<div className="mt-1 flex-1 overflow-y-auto pixel-scroll h-[250px]">
				<PixelBox>
					{team.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-[16px]">
							<svg
								viewBox="0 0 10 10"
								width={32}
								height={32}
								className="pixel-perfect opacity-30"
							>
								<circle cx={5} cy={5} r={4.5} fill="rgb(var(--pixel-red))" />
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
									fill="rgb(var(--pixel-white))"
								/>
								<circle
									cx={5}
									cy={5}
									r={1.2}
									fill="rgb(var(--pixel-white))"
									stroke="rgb(var(--pixel-black))"
									strokeWidth={0.4}
								/>
								<circle cx={5} cy={5} r={0.6} fill="rgb(var(--pixel-black))" />
							</svg>
							<p className="font-pixel text-[6px] text-pixel-gray mt-[8px]">
								NO PUBMON CAUGHT YET!
							</p>
							<p className="font-pixel text-[5px] text-pixel-gray mt-[4px]">
								ORDER A DRINK TO ENCOUNTER ONE
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-[2px] p-[2px]">
							{team.map((mon, idx) => {
								const typeInfo = TYPE_INFO[mon.type];
								const isActive = idx === activeIndex;
								const isSelected = idx === selectedIdx;

								return (
									<button
										key={`${mon.id}-${idx}`}
										onClick={() => {
											setSelectedIdx(isSelected ? null : idx);
											if (!isSelected) {
												playPokemonCry(mon.id);
											}
										}}
										className={`
                    flex items-center gap-[4px] p-[4px] border-2 cursor-pointer
                    transition-all font-pixel text-left w-full
                    ${isSelected ? "border-pixel-black bg-pixel-yellow/50" : "border-pixel-gray bg-pixel-gray-light hover:border-pixel-black"}
                  `}
									>
										{/* Sprite */}
										<div
											className="w-[32px] h-[32px] border-2 flex items-center justify-center flex-shrink-0"
											style={{
												borderColor: typeInfo.color,
												background: typeInfo.color,
											}}
										>
											<PixelSprite
												name={mon.sprite}
												size={32}
												variant={mon.spriteVariant}
											/>
										</div>

										{/* Info */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-[2px]">
												<span className="text-[6px] text-pixel-black truncate">
													{mon.name.toUpperCase()}
												</span>
												{isActive && (
													<span className="text-[5px] text-pixel-white bg-pixel-blue px-[2px] border border-pixel-blue-dark">
														LEAD
													</span>
												)}
											</div>
											<div className="flex items-center gap-[2px] mt-[1px]">
												<TypeBadge type={mon.type} />
												<span className="text-[5px] text-pixel-gray">
													LV{mon.level}
												</span>
											</div>
										</div>

										{/* HP mini bar */}
										<div className="flex-shrink-0 w-[48px]">
											<div className="w-full h-[3px] bg-pixel-black border border-pixel-white/20">
												<div
													className="h-full"
													style={{
														width: `${(mon.hp / mon.maxHp) * 100}%`,
														backgroundColor:
															mon.hp / mon.maxHp > 0.5
																? "rgb(var(--pixel-green))"
																: mon.hp / mon.maxHp > 0.2
																	? "rgb(var(--pixel-yellow))"
																	: "rgb(var(--pixel-red))",
													}}
												/>
											</div>
											<span className="font-pixel text-[4px] text-pixel-gray text-right block mt-[1px]">
												{mon.hp}/{mon.maxHp}
											</span>
										</div>
									</button>
								);
							})}

							{/* Empty slots */}
							{Array.from({ length: Math.max(0, 6 - team.length) }).map(
								(_, i) => (
									<div
										key={`empty-${i}`}
										className="flex items-center justify-center p-[8px] border-2 border-dashed border-pixel-gray-light h-[40px]"
									>
										<span className="font-pixel text-[5px] text-pixel-gray/30">
											-- EMPTY --
										</span>
									</div>
								),
							)}
						</div>
					)}
				</PixelBox>
			</div>

			{/* Selected pokemon detail */}
			{selected && selectedIdx !== null && (
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

								<div className="flex items-center gap-[4px] mt-[2px]">
									<span className="font-pixel text-[5px] text-pixel-gray-light">
										LV {selected.level}
									</span>
								</div>

								{/* Description */}
								<p className="font-pixel text-[5px] text-pixel-white leading-tight mt-[2px]">
									{selected.description}
								</p>
							</div>
						</div>

						{/* Stats */}
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
										XP
									</span>
									<span className="font-pixel text-[6px] text-pixel-white">
										{selected.xp}
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

							{/* Actions */}
							{selectedIdx !== activeIndex && (
								<button
									onClick={() => onSetActive(selectedIdx)}
									className="mt-[4px] w-full px-[4px] py-[2px] font-pixel text-[6px] border-2 border-pixel-white bg-pixel-blue-dark text-pixel-white hover:bg-pixel-yellow hover:text-pixel-black hover:border-pixel-black cursor-pointer transition-colors"
								>
									SET AS LEAD
								</button>
							)}
						</div>
					</PixelBox>
				</div>
			)}
		</div>
	);
}
