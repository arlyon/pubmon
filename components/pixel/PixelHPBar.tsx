import type React from "react";

interface PixelHPBarProps {
	current: number;
	max: number;
	label?: string;
	showNumbers?: boolean;
}

const PixelHPBar: React.FC<PixelHPBarProps> = ({
	current,
	max,
	label,
	showNumbers = true,
}) => {
	const pct = Math.max(0, Math.min(100, (current / max) * 100));
	const color =
		pct > 50
			? "bg-pixel-hp-green"
			: pct > 20
				? "bg-pixel-hp-yellow"
				: "bg-pixel-hp-red";

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-1">
				{label && (
					<span className="font-pixel text-gba-[9] text-pixel-black">
						{label}
					</span>
				)}
				<div className="flex-1 h-[8px] bg-pixel-gray-light border border-pixel-black">
					<div
						className={`h-full ${color} transition-all duration-500 ease-out`}
						style={{ width: `${pct}%` }}
					/>
				</div>
			</div>
			{showNumbers && (
				<span className="font-pixel text-gba-[9] text-pixel-black/70 text-right">
					{current}/{max}
				</span>
			)}
		</div>
	);
};

export default PixelHPBar;
