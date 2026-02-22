"use client";
import type React from "react";
import PixelBox from "./PixelBox";

interface PixelTextBoxProps {
	text: string;
	showContinue?: boolean;
	rows?: number;
}

const PixelTextBox: React.FC<PixelTextBoxProps> = ({
	text,
	showContinue = true,
	rows,
}) => {
	return (
		<PixelBox
			className="relative"
			style={rows ? { minHeight: `${rows * 21}px` } : undefined}
		>
			<p className="font-pixel text-[6px] text-pixel-black m-0 leading-[10px] whitespace-pre-line">
				{text}
			</p>
			{showContinue && (
				<div className="absolute right-2 bottom-1">
					<span
						className="font-pixel text-[6px] text-pixel-black"
						style={{ animation: "cursor-blink 0.8s step-end infinite" }}
					>
						▼
					</span>
				</div>
			)}
		</PixelBox>
	);
};

export default PixelTextBox;
