"use client";

import { motion } from "framer-motion";

export type PokeballMessageKind = "foreign" | "empty" | "error";

const COPY: Record<
	PokeballMessageKind,
	{ title: string; body: string; palette: string }
> = {
	foreign: {
		title: "NOT YOURS!",
		body: "This Pokéball belongs to another trainer. Find your own!",
		palette: "font-palette-red",
	},
	empty: {
		title: "EMPTY BALL",
		body: "You need a PubMon first! Catch one on the crawl, then tap again.",
		palette: "font-palette-yellow",
	},
	error: {
		title: "OOPS",
		body: "Couldn't reach the PubMon network. Check your connection and try again.",
		palette: "font-palette-red",
	},
};

export function PokeballMessage({
	kind,
	onDismiss,
}: {
	kind: PokeballMessageKind;
	onDismiss: () => void;
}) {
	const { title, body, palette } = COPY[kind];
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 10001,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "rgba(16, 24, 32, 0.85)",
			}}
		>
			<div className="flex flex-col items-center gap-gba-[12] p-gba-[16] text-center max-w-[280px]">
				<div className="w-gba-[48] h-gba-[48] rounded-full border-4 border-pixel-black bg-pixel-red relative overflow-hidden">
					<div className="absolute top-1/2 left-0 w-full h-[4px] -translate-y-1/2 bg-pixel-black" />
					<div className="absolute top-1/2 left-1/2 w-gba-[14] h-gba-[14] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-pixel-black bg-pixel-white" />
				</div>
				<h1 className={`font-heading text-gba-[10] ${palette} leading-tight`}>
					{title}
				</h1>
				<p className="font-sans font-palette-white text-gba-[8] leading-relaxed">
					{body}
				</p>
				<button
					type="button"
					onClick={onDismiss}
					className="mt-gba-[4] px-gba-[16] py-gba-[8] border-4 border-pixel-black bg-pixel-white text-pixel-black text-gba-[9] font-bold uppercase cursor-pointer hover:bg-pixel-gray-light"
				>
					OK
				</button>
			</div>
		</motion.div>
	);
}
