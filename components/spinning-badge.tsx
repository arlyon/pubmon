"use client";

/**
 * SpinningBadge — the fake-3D rotating gym badge used on the badge-earned
 * celebration and the pub-crawl teaser. Stacks the sprite in a few translateZ
 * layers and rotates on the Y axis (reuses the global `badge-spin` keyframe).
 *
 * Size the badge via `className` (e.g. "size-gba-[34]" or "w-32 h-32") so it
 * scales with --pixel-scale where needed.
 */
export function SpinningBadge({
	src,
	className,
	durationMs = 2400,
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
		<div className={className} style={{ perspective: "200px" }}>
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
