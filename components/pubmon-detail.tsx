"use client";

import type { PubMon } from "@/lib/pokemon-data";
import { TYPE_INFO } from "@/lib/pokemon-data";
import { PixelBox } from "./pixel-box";
import { PixelSprite, TypeBadge } from "./pixel-sprite";

interface PubMonDetailPanelProps {
	mon: PubMon;
	onCry: () => void;
	/** Content rendered beside the sprite, after the TypeBadge row (status, level). */
	children?: React.ReactNode;
	/** Flavour text rendered full-width beneath the sprite/info row. */
	description?: string;
	/** If provided, renders the stats grid + moves section */
	stats?: { label: string; value: string | number }[];
	/** Action buttons rendered at the bottom of the stats section */
	actions?: React.ReactNode;
}

/** Crisp pixel speaker glyph for the cry button (inherits `currentColor`). */
function SpeakerIcon() {
	return (
		<svg
			viewBox="0 0 12 12"
			className="size-gba-[9]"
			shapeRendering="crispEdges"
			fill="currentColor"
			aria-hidden="true"
		>
			<rect x="1" y="5" width="1" height="2" />
			<rect x="2" y="4" width="1" height="4" />
			<rect x="3" y="3" width="1" height="6" />
			<rect x="4" y="2" width="1" height="8" />
			<rect x="6" y="5" width="1" height="2" />
			<rect x="7" y="4" width="1" height="1" />
			<rect x="7" y="7" width="1" height="1" />
			<rect x="8" y="3" width="1" height="1" />
			<rect x="8" y="8" width="1" height="1" />
		</svg>
	);
}

export function PubMonDetailPanel({
	mon,
	onCry,
	children,
	description,
	stats,
	actions,
}: PubMonDetailPanelProps) {
	return (
		<PixelBox variant="blue" className="p-2">
			<button
				type="button"
				onClick={onCry}
				title="Play cry"
				className="z-10 shrink-0 flex absolute right-0 top-0 items-center justify-center size-gba-[16] border-[2px] border-pixel-black text-pixel-white cursor-pointer transition-colors hover:bg-pixel-white/20"
				style={{
					background: "rgb(var(--pixel-blue-dark))",
					boxShadow:
						"inset 1px 1px 0 rgba(255,255,255,0.25), inset -1px -1px 0 rgba(0,0,0,0.35)",
				}}
			>
				<SpeakerIcon />
			</button>
			<div className="flex gap-gba-[6] relative">
				{/* Sprite */}
				<div
					className="size-gba-[44] border-[2px] border-pixel-white flex items-center justify-center shrink-0"
					style={{
						background: TYPE_INFO[mon.type].color,
						boxShadow:
							"inset 2px 2px 0 rgba(255,255,255,0.25), inset -2px -2px 0 rgba(0,0,0,0.3)",
					}}
				>
					<PixelSprite
						name={mon.sprite}
						size={40}
						animated
						variant={mon.spriteVariant}
					/>
				</div>

				{/* Info */}
				<div className="flex flex-col flex-1 min-w-0 gap-gba-[4]">
					<div className="flex items-center gap-gba-[4]">
						<span className="font-sans font-palette-muted text-gba-[9]">
							#{String(mon.id).padStart(3, "0")}
						</span>
						<h3 className="font-sans font-palette-blue text-gba-[9] m-0 truncate">
							{mon.name.toUpperCase()}
						</h3>
					</div>

					<div className="flex items-center gap-gba-[4]">
						<TypeBadge type={mon.type} />
						<span className="font-sans font-palette-muted text-gba-[7]">
							{TYPE_INFO[mon.type].element.toUpperCase()}
						</span>
					</div>

					{children}
				</div>
			</div>

			{description && (
				<p className="font-sans font-palette-blue text-gba-[7] leading-relaxed mt-gba-[3]">
					{description}
				</p>
			)}

			{stats && (
				<div className="mt-gba-[2]">
					<div className="grid grid-cols-4 gap-gba-[1]">
						{stats.map(({ label, value }) => (
							<div
								key={label}
								className="flex flex-col items-center leading-none"
							>
								<span className="font-sans font-palette-muted text-gba-[6] leading-none">
									{label}
								</span>
								<span className="font-sans font-palette-blue text-gba-[9] leading-none">
									{value}
								</span>
							</div>
						))}
					</div>

					{/* Moves */}
					<div className="mt-gba-[3]">
						<span className="font-sans font-palette-muted text-gba-[6] mb-gba-[2] block">
							MOVES
						</span>
						<div className="grid grid-cols-2 gap-gba-[2]">
							{mon.moves.map((move) => (
								<div
									key={move}
									className="border-[2px] border-pixel-white/40 px-gba-[3] py-gba-[2] font-sans font-palette-blue text-gba-[7] text-center truncate"
									style={{ background: "rgb(var(--pixel-blue-dark))" }}
								>
									{move.toUpperCase()}
								</div>
							))}
						</div>
					</div>

					{actions && (
						<div className="flex flex-col gap-gba-[3] mt-gba-[4]">
							{actions}
						</div>
					)}
				</div>
			)}
		</PixelBox>
	);
}
