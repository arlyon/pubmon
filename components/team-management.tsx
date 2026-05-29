"use client";

import { useState } from "react";
import { usePokemonCry } from "@/hooks/use-pokemon-cry";
import { type PubMon, TYPE_INFO } from "@/lib/pokemon-data";
import PixelBox from "./pixel/PixelBox";
import PixelHeader from "./pixel/PixelHeader";
import { PixelButton } from "./pixel-box";
import { PixelSprite, TypeBadge } from "./pixel-sprite";
import { PubMonDetailPanel } from "./pubmon-detail";

interface TeamManagementProps {
	team: PubMon[];
	onBack: () => void;
	onSetActive: (index: number) => void;
	activeIndex: number;
	onPlay: (pubmon: PubMon) => void;
}

export function TeamManagement({
	team,
	onBack,
	onSetActive,
	activeIndex,
	onPlay,
}: TeamManagementProps) {
	const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
	const selected = selectedIdx !== null ? team[selectedIdx] : null;
	const { playPokemonCry } = usePokemonCry(team);

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			<PixelHeader
				title="PUBMON"
				subtitle="YOUR PARTY"
				variant="blue"
				right={
					<div className="text-right">
						<div className="text-gba-[6] font-palette-white">SIZE</div>
						<div className="text-gba-[10] font-palette-yellow">
							{team.length}/6
						</div>
					</div>
				}
			/>

			{/* Party list */}
			<div className="mt-gba-[1] flex-1 overflow-y-auto pixel-scroll min-h-gba-[120]">
				<PixelBox>
					{team.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-gba-[16]">
							<img
								src="/sprites/POKEBALL.png"
								alt="pokeball"
								className="pixel-perfect opacity-30 size-gba-[32]"
							/>
							<p className=" text-gba-[6] text-pixel-gray mt-gba-[8]">
								NO PUBMON CAUGHT YET!
							</p>
							<p className=" text-gba-[5] text-pixel-gray mt-gba-[4]">
								ORDER A DRINK TO ENCOUNTER ONE
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-gba-[2] p-gba-[2]">
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
                    flex items-center gap-gba-[4] p-gba-[4] border-gba-[2] cursor-pointer
                    transition-all  text-left w-full
                    ${isSelected ? "border-pixel-black bg-pixel-yellow/50" : "border-pixel-gray bg-pixel-gray-light hover:border-pixel-black"}
                  `}
									>
										{/* Sprite */}
										<div
											className="size-gba-[32] border-gba-[2] flex items-center justify-center flex-shrink-0"
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
											<div className="flex items-center gap-gba-[2]">
												<span className="text-gba-[6] text-pixel-black truncate">
													{mon.name.toUpperCase()}
												</span>
												{isActive && (
													<span className="text-gba-[5] text-pixel-white bg-pixel-blue px-gba-[2] border border-pixel-blue-dark">
														LEAD
													</span>
												)}
											</div>
											<div className="flex items-center gap-gba-[2] mt-gba-[1]">
												<TypeBadge type={mon.type} />
												<span className="text-gba-[5] text-pixel-gray">
													LV{mon.level}
												</span>
											</div>
										</div>

										{/* HP mini bar */}
										<div className="flex-shrink-0 w-gba-[48]">
											<div className="w-full h-gba-[3] bg-pixel-black border border-pixel-white/20">
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
											<span className=" text-gba-[4] text-pixel-gray text-right block mt-gba-[1]">
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
										className="flex items-center justify-center p-gba-[8] border-gba-[2] border-dashed border-pixel-gray-light h-gba-[40]"
									>
										<span className=" text-gba-[5] text-pixel-gray/30">
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
				<div className="mb-gba-[4]">
					<PubMonDetailPanel
						mon={selected}
						onCry={() => playPokemonCry(selected.id)}
						stats={[
							{ label: "HP", value: selected.maxHp },
							{ label: "ATK", value: selected.attack },
							{ label: "DEF", value: selected.defense },
							{ label: "XP", value: selected.xp },
						]}
						actions={
							<>
								{selectedIdx !== activeIndex && (
									<button
										onClick={() => onSetActive(selectedIdx)}
										className="mt-gba-[4] w-full px-gba-[4] py-gba-[2] font-sans font-palette-blue text-gba-[6] border-gba-[2] border-pixel-white bg-pixel-blue-dark hover:bg-pixel-yellow hover:font-palette-default hover:border-pixel-black cursor-pointer transition-colors"
									>
										SET AS LEAD
									</button>
								)}
								<button
									onClick={() => selected && onPlay(selected)}
									className="mt-gba-[4] w-full px-gba-[4] py-gba-[2] font-sans font-palette-green text-gba-[6] border-gba-[2] border-pixel-green bg-pixel-green-dark hover:bg-pixel-green hover:font-palette-default hover:border-pixel-black cursor-pointer transition-colors"
								>
									PLAY!
								</button>
							</>
						}
					>
						<div className="flex items-center gap-gba-[4] mt-gba-[2]">
							<span className="font-sans font-palette-muted text-gba-[5]">
								LV {selected.level}
							</span>
						</div>
						<p className="font-sans font-palette-blue text-gba-[5] leading-tight mt-gba-[2]">
							{selected.description}
						</p>
					</PubMonDetailPanel>
				</div>
			)}
		</div>
	);
}
