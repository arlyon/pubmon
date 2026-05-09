"use client";

import type { PubMon } from "@/lib/pokemon-data";
import { TYPE_INFO } from "@/lib/pokemon-data";
import PixelBox from "./pixel/PixelBox";
import { PixelSprite, TypeBadge } from "./pixel-sprite";

interface PubMonDetailPanelProps {
	mon: PubMon;
	onCry: () => void;
	/** Content rendered after the TypeBadge row (status, level, description, etc.) */
	children?: React.ReactNode;
	/** If provided, renders the stats grid + moves section */
	stats?: { label: string; value: string | number }[];
	/** Action buttons rendered at the bottom of the stats section */
	actions?: React.ReactNode;
}

export function PubMonDetailPanel({
	mon,
	onCry,
	children,
	stats,
	actions,
}: PubMonDetailPanelProps) {
	return (
		<PixelBox variant="blue">
			<div className="flex gap-gba-[4] relative">
				{/* Sprite */}
				<div
					className="size-gba-[48] border-gba-[2] flex items-center justify-center shrink-0"
					style={{
						borderColor: "rgb(var(--pixel-white))",
						background: TYPE_INFO[mon.type].color,
					}}
				>
					<PixelSprite
						name={mon.sprite}
						size={48}
						animated
						variant={mon.spriteVariant}
					/>
				</div>

				{/* Info */}
				<div className="flex flex-col gap-gba-[2] flex-1 min-w-0">
					<div className="flex items-center gap-gba-[4]">
						<span className="font-sans font-palette-muted text-gba-[6]">
							#{String(mon.id).padStart(3, "0")}
						</span>
						<h3 className="font-sans font-palette-blue text-gba-[8] m-0">
							{mon.name.toUpperCase()}
						</h3>
						<button
							type="button"
							onClick={onCry}
							className="ml-auto px-gba-[4] py-gba-[2] font-sans font-palette-blue text-gba-[6] border-gba-[2] cursor-pointer transition-colors"
							title="Play cry"
						>
							🔊
						</button>
					</div>

					<div className="flex items-center gap-gba-[4] mt-gba-[2]">
						<TypeBadge type={mon.type} />
						<span className="font-sans font-palette-muted text-gba-[5]">
							{TYPE_INFO[mon.type].element.toUpperCase()}
						</span>
					</div>

					{children}
				</div>
			</div>

			{stats && (
				<div className="mt-gba-[4] pt-gba-[4] border-t-gba-[2] border-pixel-white/30">
					<div className="grid grid-cols-4 gap-gba-[2]">
						{stats.map(({ label, value }) => (
							<div key={label} className="flex flex-col items-center">
								<span className="font-sans font-palette-muted text-gba-[5]">
									{label}
								</span>
								<span className="font-sans font-palette-blue text-gba-[6]">
									{value}
								</span>
							</div>
						))}
					</div>

					{/* Moves */}
					<div className="mt-gba-[4]">
						<span className="font-sans font-palette-muted text-gba-[5] mb-gba-[2] block">
							MOVES
						</span>
						<div className="grid grid-cols-2 gap-gba-[2]">
							{mon.moves.map((move) => (
								<div
									key={move}
									className="bg-pixel-blue-dark border border-pixel-white/50 px-gba-[2] py-gba-[2] font-sans font-palette-blue text-gba-[5] text-center"
								>
									{move.toUpperCase()}
								</div>
							))}
						</div>
					</div>

					{actions && (
						<div className="flex flex-col gap-gba-[2]">{actions}</div>
					)}
				</div>
			)}
		</PixelBox>
	);
}
