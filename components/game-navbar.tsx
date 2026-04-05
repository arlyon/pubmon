"use client";

import type { ReactNode } from "react";

interface NavButtonProps {
	icon: ReactNode;
	label: string;
	isActive: boolean;
	onClick: () => void;
	activeColorClass: string;
	activeFontPalette?: string;
}

function NavButton({
	icon,
	label,
	isActive,
	onClick,
	activeColorClass,
	activeFontPalette,
}: NavButtonProps) {
	const fontPaletteClass = activeFontPalette
		? `[font-palette:${activeFontPalette}]`
		: "";

	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer transition-colors ${
				isActive
					? `${activeColorClass} ${fontPaletteClass}`
					: "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"
			}`}
		>
			{icon}
			<span>{label}</span>
		</button>
	);
}

interface GameNavbarProps {
	isHidden: boolean;
	activeTab: "crawl" | "pokedex" | "team" | "league";
	onNavigate: (phase: "crawl" | "pokedex" | "team" | "league") => void;
}

export function GameNavbar({
	isHidden,
	activeTab,
	onNavigate,
}: GameNavbarProps) {
	if (isHidden) return null;

	return (
		<nav
			className="border-t-4 border-pixel-black bg-pixel-white text-gba-[9]"
			style={{
				paddingBottom: "max(8px, var(--safe-area-inset-bottom, 0px))",
			}}
		>
			<div className="max-w-md mx-auto flex items-stretch">
				<NavButton
					icon={
						<svg viewBox="0 0 8 8" className="pixel-perfect size-gba-[12]">
							<title>Crawl icon</title>
							<rect x={2} y={0} width={4} height={1} fill="currentColor" />
							<rect x={1} y={1} width={6} height={5} fill="currentColor" />
							<rect x={3} y={6} width={2} height={2} fill="currentColor" />
						</svg>
					}
					label="CRAWL"
					isActive={activeTab === "crawl"}
					onClick={() => onNavigate("crawl")}
					activeColorClass="bg-pixel-blue text-pixel-white"
					activeFontPalette="--emerald-blue"
				/>

				<div className="w-[2px] bg-pixel-gray/30" />

				<NavButton
					icon={
						<svg viewBox="0 0 12 12" className="pixel-perfect size-gba-[12]">
							<title>Pubdex icon</title>
							<rect
								x={0}
								y={0}
								width={12}
								height={12}
								rx={1}
								fill="currentColor"
							/>
							<rect
								x={1}
								y={1}
								width={10}
								height={10}
								rx={1}
								fill="rgb(var(--pixel-white))"
							/>
							<rect
								x={2}
								y={2}
								width={8}
								height={5}
								fill="currentColor"
								opacity={0.3}
							/>
							<rect
								x={3}
								y={8}
								width={6}
								height={1}
								fill="currentColor"
								opacity={0.3}
							/>
						</svg>
					}
					label="PUBDEX"
					isActive={activeTab === "pokedex"}
					onClick={() => onNavigate("pokedex")}
					activeColorClass="bg-pixel-red text-pixel-white"
					activeFontPalette="--emerald-red"
				/>

				<div className="w-[2px] bg-pixel-gray/30" />

				<NavButton
					icon={
						<svg viewBox="0 0 10 10" className="pixel-perfect size-gba-[12]">
							<title>Pubmon icon</title>
							<circle
								cx={5}
								cy={5}
								r={4.5}
								fill="none"
								stroke="currentColor"
								strokeWidth={1}
							/>
							<rect x={0.5} y={4.5} width={9} height={1} fill="currentColor" />
							<circle cx={5} cy={5} r={1.5} fill="currentColor" />
						</svg>
					}
					label="PUBMON"
					isActive={activeTab === "team"}
					onClick={() => onNavigate("team")}
					activeColorClass="bg-pixel-blue text-pixel-white"
					activeFontPalette="--emerald-blue"
				/>

				<div className="w-[2px] bg-pixel-gray/30" />

				<NavButton
					icon={
						<svg viewBox="0 0 12 12" className="pixel-perfect size-gba-[12]">
							<title>League icon</title>
							<polygon
								points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9 3,11 3.5,7.5 1,5 4.5,4.5"
								fill="currentColor"
							/>
						</svg>
					}
					label="LEAGUE"
					isActive={activeTab === "league"}
					onClick={() => onNavigate("league")}
					activeColorClass="bg-pixel-yellow text-pixel-black"
					activeFontPalette="--emerald-yellow"
				/>
			</div>
		</nav>
	);
}
