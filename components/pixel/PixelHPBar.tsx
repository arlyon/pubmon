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
		<div className="flex flex-col gap-gba-[2]">
			<div className="flex items-center gap-gba-[2]">
				{label && (
					<span className=" text-gba-[9] text-pixel-black">{label}</span>
				)}
				<div className="flex-1 h-gba-[4] bg-pixel-gray-light border-gba-[0.7] border-pixel-black">
					<div
						className={`h-full ${color} transition-all duration-500 linear`}
						style={{ width: `${pct}%` }}
					/>
				</div>
			</div>
			{showNumbers && (
				<span className=" text-gba-[9] text-pixel-black/70 text-right">
					{current}/{max}
				</span>
			)}
		</div>
	);
};

export default PixelHPBar;
