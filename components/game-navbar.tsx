"use client";

import type { ReactNode } from "react";
import { IconCrawl } from "./images/IconCrawl";
import { IconLeague } from "./images/IconLeague";
import { IconPubdex } from "./images/IconPubdex";
import { IconPubmon } from "./images/IconPubmon";
import { IconSettings } from "./images/IconSettings";

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
	activeTab: "crawl" | "pokedex" | "team" | "league" | "settings";
	onNavigate: (
		phase: "crawl" | "pokedex" | "team" | "league" | "settings",
	) => void;
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
			style={
				{
					// paddingBottom: "max(8px, var(--safe-area-inset-bottom, 0px))",
				}
			}
		>
			<div className="flex items-stretch w-full">
				<NavButton
					icon={<IconCrawl />}
					label="CRAWL"
					isActive={activeTab === "crawl"}
					onClick={() => onNavigate("crawl")}
					activeColorClass="bg-pixel-blue text-pixel-white"
					activeFontPalette="--emerald-blue"
				/>

				<div className="w-[1px] bg-pixel-gray/30" />

				<NavButton
					icon={<IconPubdex />}
					label="PUBDEX"
					isActive={activeTab === "pokedex"}
					onClick={() => onNavigate("pokedex")}
					activeColorClass="bg-pixel-red text-pixel-white"
					activeFontPalette="--emerald-red"
				/>

				<div className="w-[1px] bg-pixel-gray/30" />

				<NavButton
					icon={<IconPubmon />}
					label="PUBMON"
					isActive={activeTab === "team"}
					onClick={() => onNavigate("team")}
					activeColorClass="bg-pixel-blue text-pixel-white"
					activeFontPalette="--emerald-blue"
				/>

				<div className="w-[1px] bg-pixel-gray/30" />

				<NavButton
					icon={<IconLeague />}
					label="LEAGUE"
					isActive={activeTab === "league"}
					onClick={() => onNavigate("league")}
					activeColorClass="bg-pixel-yellow text-pixel-black"
					activeFontPalette="--emerald-yellow"
				/>

				<div className="w-[1px] bg-pixel-gray/30" />

				<NavButton
					icon={<IconSettings />}
					label="OPTS"
					isActive={activeTab === "settings"}
					onClick={() => onNavigate("settings")}
					activeColorClass="bg-pixel-gray text-pixel-white"
				/>
			</div>
		</nav>
	);
}
