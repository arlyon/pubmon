"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import { GYMS, type Gym } from "@/lib/gym-data";
import { useAudio } from "./audio-manager";
import { SpinningBadge } from "./Badge3D";
import { GymTrailInline } from "./gym-trail";
import PixelHeader from "./pixel/PixelHeader";
import { PixelBox, PixelButton } from "./pixel-box";
import { Pokedex } from "./pokedex";

type TeaserTab = "crawl" | "badges" | "pubdex";

const TAB_ORDER: TeaserTab[] = ["crawl", "badges", "pubdex"];

// Direction-aware horizontal slide between tab panels.
const slideVariants = {
	enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
	center: { x: "0%", opacity: 1 },
	exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0 }),
};

// ── Drink-type metadata (matches the design A "By the book" palette) ──────────
const TYPE_META: Record<string, { color: string; fg: string; label: string }> =
	{
		Beer: { color: "#c28b4a", fg: "#fff", label: "BEER" },
		Shot: { color: "#e43b44", fg: "#fff", label: "SHOT" },
		Wine: { color: "#f4a4c0", fg: "#282828", label: "WINE" },
		Water: { color: "#63c6e1", fg: "#282828", label: "WATER" },
		Cocktail: { color: "#63c74d", fg: "#282828", label: "CKTL" },
	};

const dirUrl = (g: Gym) =>
	`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}`;

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

interface TournamentTeaserProps {
	/** Earned badge ids (gym ids). Empty when logged out. */
	badges?: Set<number>;
	/** Seen pubmon ids. Empty when logged out. */
	seenIds?: Set<number>;
	/** Caught pubmon ids. Empty when logged out. */
	caughtIds?: Set<number>;
}

// ── Pixel pokéball brand mark (header right) ─────────────────────────────────
function PokeballMark() {
	return (
		<svg
			viewBox="0 0 10 10"
			className="size-gba-[24]"
			shapeRendering="crispEdges"
			aria-hidden
		>
			<circle
				cx="5"
				cy="5"
				r="4.5"
				fill="none"
				stroke="#f8f8f8"
				strokeWidth="1"
			/>
			<rect x="0.5" y="4.5" width="9" height="1" fill="#f8f8f8" />
			<circle cx="5" cy="5" r="1.5" fill="#f8f8f8" />
		</svg>
	);
}

function TypeBadge({ type }: { type: string }) {
	const meta = TYPE_META[type] ?? TYPE_META.Beer!;
	const palette =
		meta.fg === "#282828" ? "font-palette-default" : "font-palette-white";
	return (
		<span
			className={`shrink-0 inline-block whitespace-nowrap leading-none px-gba-[5] py-gba-[3] border-gba-[1] border-[#282828] text-gba-[7] font-sans ${palette}`}
			style={{ background: meta.color }}
		>
			{meta.label}
		</span>
	);
}

// ── Countdown: framed digit blocks inside a white PixelBox ───────────────────
function TimerBox() {
	const { days, hours, minutes, seconds } = useCountdown();
	const blocks: [string, number][] = [
		["DAYS", days],
		["HRS", hours],
		["MIN", minutes],
		["SEC", seconds],
	];
	return (
		<PixelBox className="p-2">
			<div className="text-center text-gba-[8] font-sans font-palette-default mb-gba-[4]">
				★ CRAWL BEGINS IN ★
			</div>
			<div className="flex justify-center gap-gba-[4]" suppressHydrationWarning>
				{blocks.map(([label, val], i) => (
					<div key={label} className="flex">
						{i > 0 && (
							<span className="self-start text-gba-[14] font-sans font-palette-default mt-gba-[7] mx-gba-[2]">
								:
							</span>
						)}
						<div className="flex flex-col items-center gap-gba-[3]">
							<div
								className="text-center leading-none text-gba-[16] font-sans font-palette-default py-gba-[3] px-gba-[1] w-gba-[28] border-gba-[1] border-[#282828]"
								style={{
									background: "#d8e0e8",
									boxShadow:
										"inset 1px 1px 0 #f8f8f8, inset -1px -1px 0 #a8b0b8",
								}}
							>
								{pad(val)}
							</div>
							<div className="text-gba-[6] font-sans font-palette-muted">
								{label}
							</div>
						</div>
					</div>
				))}
			</div>
		</PixelBox>
	);
}

// ── Featured first stop (blue PixelBox + the Badge3D spinner) ────────────────
function FirstStop({ gym }: { gym: Gym }) {
	return (
		<PixelBox variant="blue" className="p-2">
			<div className="text-gba-[7] font-sans font-palette-yellow mb-gba-[6]">
				▶ FIRST STOP
			</div>
			<div className="flex items-center gap-gba-[9]">
				<div
					className="shrink-0 p-gba-[4] border-gba-[1] border-[#282828]"
					style={{ background: "#f8f8f8" }}
				>
					<SpinningBadge
						src={gym.badgeSprite}
						className="size-gba-[34]"
						durationMs={2400}
						depth={1}
						silhouette
					/>
				</div>
				<div className="flex-1 min-w-0">
					<div
						className="text-gba-[10] font-sans font-palette-white"
						style={{ lineHeight: 1.35 }}
					>
						{gym.name}
					</div>
					<div className="flex items-center gap-gba-[6] mt-gba-[5]">
						<TypeBadge type={gym.specialty} />
						<span className="text-gba-[6] font-sans font-palette-white">
							LEADER {gym.leaderName}
						</span>
					</div>
				</div>
			</div>
			<PixelButton
				variant="yellow"
				onClick={() => window.open(dirUrl(gym), "_blank")}
				className="w-full text-center mt-gba-[8]"
			>
				GET DIRECTIONS →
			</PixelButton>
		</PixelBox>
	);
}

// ── A single upcoming-stop row (white PixelBox, badge blanked) ───────────────
function StopRow({ gym, index }: { gym: Gym; index: number }) {
	return (
		<PixelBox className="p-gba-[4] px-gba-[6]">
			<div className="flex items-center gap-gba-[4]">
				<span className="shrink-0 w-gba-[10] text-center text-gba-[8] font-sans font-palette-muted leading-none">
					{pad(index)}
				</span>
				<SpinningBadge
					src={gym.badgeSprite}
					className="size-gba-[16] shrink-0"
					durationMs={2600}
					depth={1}
					silhouette
					delayMs={index * 280}
				/>
				<div className="flex-1 min-w-0 flex flex-col gap-gba-[1]">
					<div className="text-gba-[10] font-sans font-palette-default truncate leading-none">
						{gym.name}
					</div>
					<div className="text-gba-[6] font-sans font-palette-muted truncate leading-none">
						LEADER {gym.leaderName}
					</div>
				</div>
				<TypeBadge type={gym.specialty} />
			</div>
		</PixelBox>
	);
}

// ── Tabs — sit directly under the header ─────────────────────────────────────
function TeaserTabs({
	active,
	onSelect,
}: {
	active: TeaserTab;
	onSelect: (tab: TeaserTab) => void;
}) {
	const tabs: [TeaserTab, string][] = [
		["crawl", "CRAWL"],
		["badges", "BADGES"],
		["pubdex", "PUBDEX"],
	];
	return (
		<div
			className="flex gap-gba-[2] p-gba-[2] shrink-0 border-b-gba-[1] border-b-[#282828]"
			style={{ background: "#101828" }}
		>
			{tabs.map(([id, label]) => {
				const on = active === id;
				return (
					<button
						key={id}
						type="button"
						onClick={() => onSelect(id)}
						className={`flex-1 text-gba-[7] py-gba-[3] border-gba-[1] border-[#282828] cursor-pointer font-sans ${
							on ? "font-palette-white" : "font-palette-default"
						}`}
						style={{
							background: on ? "#d03838" : "#f8f8f8",
							boxShadow: on
								? "inset -2px -2px 0 rgba(0,0,0,0.25)"
								: "inset 1px 1px 0 #fff, inset -2px -2px 0 #a8b0b8",
						}}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}

export function TournamentTeaser({
	badges = new Set(),
	seenIds = new Set(),
	caughtIds = new Set(),
}: TournamentTeaserProps) {
	const { remainingMs } = useCountdown();
	const [tab, setTab] = useState<TeaserTab>("crawl");
	const [dir, setDir] = useState(0);
	const { playBGM } = useAudio();

	const selectTab = (next: TeaserTab) => {
		setDir(TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(tab) ? 1 : -1);
		setTab(next);
	};

	// Keep the title theme going on the teaser.
	useEffect(() => {
		playBGM("title-screen");
	}, [playBGM]);

	// When the clock hits zero, hard reload so everyone drops into the live game.
	// (GameShell also schedules this, but reloading here covers any drift.)
	useEffect(() => {
		if (remainingMs <= 0) {
			window.location.reload();
		}
	}, [remainingMs]);

	const first = GYMS[0]!;

	return (
		<div className="w-full mx-auto flex flex-col h-dvh font-sans">
			<PixelHeader
				title="2026 PUB CRAWL"
				subtitle={`LAMBETH LEAGUE · ${GYMS.length} STOPS`}
				variant="red"
				right={<PokeballMark />}
			/>

			<TeaserTabs active={tab} onSelect={selectTab} />

			<div className="flex-1 min-h-0 relative overflow-hidden">
				<AnimatePresence initial={false} custom={dir}>
					<motion.div
						key={tab}
						custom={dir}
						variants={slideVariants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}
						className="absolute inset-0 flex flex-col min-h-0"
					>
						{tab === "crawl" && (
							<div className="flex-1 min-h-0 flex flex-col gap-gba-[8] p-gba-[9] overflow-y-auto pixel-scroll">
								<TimerBox />
								<FirstStop gym={first} />
								<div className="flex flex-col gap-gba-[4]">
									{GYMS.slice(1).map((gym) => (
										<StopRow key={gym.id} gym={gym} index={gym.id} />
									))}
								</div>
							</div>
						)}

						{tab === "badges" && (
							<div className="flex-1 min-h-0 font-sans">
								<GymTrailInline
									currentGymId={first.id}
									badges={badges}
									onSelectGym={() => {}}
									onClose={() => selectTab("crawl")}
								/>
							</div>
						)}

						{tab === "pubdex" && (
							<div className="flex-1 min-h-0 font-sans">
								<Pokedex
									seenIds={seenIds}
									caughtIds={caughtIds}
									onBack={() => selectTab("crawl")}
								/>
							</div>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
