import type React from "react";

const VARIANTS = {
	blue: {
		bg: "bg-[#384080]",
		palette: "font-palette-blue",
	},
	red: {
		bg: "bg-pixel-red",
		palette: "font-palette-red",
	},
	dark: {
		bg: "bg-[#262b44]",
		palette: "font-palette-blue",
	},
	gray: {
		bg: "bg-pixel-gray",
		palette: "font-palette-default",
	},
} as const;

interface PixelHeaderProps {
	title: string;
	subtitle?: string;
	variant?: keyof typeof VARIANTS;
	right?: React.ReactNode;
}

const PixelHeader: React.FC<PixelHeaderProps> = ({
	title,
	subtitle,
	variant = "blue",
	right,
}) => {
	const v = VARIANTS[variant];

	return (
		<div
			className={`${v.bg} px-gba-[8] py-gba-[6] border-b border-pixel-black flex justify-between items-center font-sans ${v.palette}`}
		>
			<div>
				<div className="text-gba-[9]">{title}</div>
				{subtitle && (
					<div className="text-gba-[6] mt-gba-[2] font-palette-white">
						{subtitle}
					</div>
				)}
			</div>
			{right && right}
		</div>
	);
};

export default PixelHeader;
