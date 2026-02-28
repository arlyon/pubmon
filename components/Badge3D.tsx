"use client";

import { GYMS } from "@/lib/gym-data";

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
				<div
					className="relative"
					style={{
						perspective: "1000px",
					}}
				>
					<div
						className="relative"
						style={{
							transformStyle: "preserve-3d",
							animation: "spin-y 3s linear infinite",
						}}
					>
						{/* Create fake 3D depth with multiple layers */}
						{[0, 1, 2, 3, 4].map((layer) => (
							<img
								key={layer}
								src={gym.badgeSprite}
								alt={gym.badgeName}
								width={128}
								height={128}
								className="absolute top-0 left-0"
								style={{
									imageRendering: "pixelated",
									transform: `translateZ(${layer * 2}px)`,
									filter: layer > 0 ? `brightness(${1 - layer * 0.1})` : "none",
								}}
							/>
						))}
					</div>
				</div>

				{/* Badge Info */}
				<div className="flex flex-col items-center gap-2 text-center">
					<p
						className="text-[20px] text-primary font-pixel"
						style={{
							animation: "pixel-bounce 1s ease-in-out infinite",
						}}
					>
						BADGE EARNED!
					</p>
					<p className="text-[14px] text-foreground font-sans">
						{gym.badgeName}
					</p>
					<p className="text-[10px] text-muted-foreground font-sans">
						Awarded by {gym.leaderName} at {gym.name}
					</p>
				</div>

				{/* Continue Button */}
				<button
					type="button"
					onClick={onContinue}
					className="border-4 border-foreground bg-primary text-primary-foreground px-8 py-4 text-[12px] font-sans shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] hover:brightness-110 transition-all"
				>
					CONTINUE
				</button>
			</div>

			<style jsx>{`
        @keyframes spin-y {
          from {
            transform: rotateY(0deg);
          }
          to {
            transform: rotateY(360deg);
          }
        }
      `}</style>
		</div>
	);
}
