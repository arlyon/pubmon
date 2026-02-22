"use client";
import type React from "react";
import { useState } from "react";
import PixelBox from "./PixelBox";

interface PixelMenuProps {
	items: string[];
	onSelect?: (index: number) => void;
	variant?: "default" | "blue" | "red";
}

const PixelMenu: React.FC<PixelMenuProps> = ({
	items,
	onSelect,
	variant = "default",
}) => {
	const [selected, setSelected] = useState(0);

	const handleClick = (index: number) => {
		setSelected(index);
		onSelect?.(index);
	};

	const textColor =
		variant === "default" ? "text-pixel-black" : "text-pixel-white";

	return (
		<PixelBox variant={variant}>
			<ul className="list-none p-0 m-0">
				{items.map((item, i) => (
					<li
						key={i}
						onClick={() => handleClick(i)}
						className={`relative cursor-pointer font-pixel text-[6px] py-[2px] pl-[4px] pr-[1px] ${textColor} ${
							i === selected ? "pixel-cursor" : ""
						}`}
					>
						{item}
					</li>
				))}
			</ul>
		</PixelBox>
	);
};

export default PixelMenu;
