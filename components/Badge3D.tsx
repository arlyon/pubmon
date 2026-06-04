"use client";

import { GYMS } from "@/lib/gym-data";

/**
 * The fake-3D rotating gym badge: stacks the sprite in translateZ layers and
 * spins on the Y axis (global `badge-spin` keyframe). Size it via `className`
 * (e.g. "w-32 h-32" or "size-gba-[34]") so it can scale with --pixel-scale.
 */
export function SpinningBadge({
	src,
	className = "w-32 h-32",
	durationMs = 3000,
	depth = 2,
	layers = 5,
}: {
	src: string;
	className?: string;
	durationMs?: number;
	depth?: number;
	layers?: number;
}) {
	return (
		<div className={className} style={{ perspective: "1000px" }}>
			<div
				className="relative w-full h-full"
				style={{
					transformStyle: "preserve-3d",
					animation: `badge-spin ${durationMs}ms linear infinite`,
				}}
			>
				{Array.from({ length: layers }).map((_, layer) => (
					<img
						key={layer}
						src={src}
						alt=""
						className="absolute inset-0 w-full h-full"
						style={{
							imageRendering: "pixelated",
							transform: `translateZ(${layer * depth}px)`,
							filter: layer > 0 ? `brightness(${1 - layer * 0.1})` : "none",
						}}
					/>
				))}
			</div>
		</div>
	);
}

interface Badge3DProps {
	badgeId: number;
	onContinue: () => void;
}

export function Badge3D({ badgeId, onContinue }: Badge3DProps) {
	const gym = GYMS.find((g) => g.id === badgeId);

	if (!gym) return null;

	return (
		<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-pixel-black/90">
			<div className="flex flex-col items-center gap-6 max-w-md px-4">
				{/* 3D Badge Display */}
				<SpinningBadge src={gym.badgeSprite} className="w-32 h-32" />

				{/* Badge Info */}
				<div className="flex flex-col items-center gap-2 text-center">
					<p
						className="text-gba-[9]  font-palette-white"
						style={{
							animation: "pixel-bounce 1s ease-in-out infinite",
						}}
					>
						BADGE EARNED!
					</p>
					<p className="text-gba-[9] font-sans font-palette-white">
						{gym.badgeName}
					</p>
					<p className="text-gba-[9] font-sans font-palette-muted">
						Awarded by {gym.leaderName} at {gym.name}
					</p>
				</div>

				{/* Continue Button */}
				<button
					type="button"
					onClick={onContinue}
					className="border-4 border-foreground bg-primary text-primary-foreground px-8 py-4 text-gba-[9] font-sans font-palette-blue shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] hover:brightness-110 transition-all"
				>
					CONTINUE
				</button>
			</div>
		</div>
	);
}
