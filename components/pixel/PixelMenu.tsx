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

	const palette =
		variant === "default" ? "font-palette-no-shadow" : variant === "blue" ? "font-palette-blue" : "font-palette-red";

	return (
		<PixelBox variant={variant}>
			<ul className="list-none p-0 m-0">
				{items.map((item, i) => (
					<li
						key={i}
						onClick={() => handleClick(i)}
						className={`relative cursor-pointer font-sans text-gba-[9] py-gba-[2] pl-gba-[4] pr-gba-[1] ${palette} ${
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
