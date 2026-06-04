"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import { GYMS, type Gym } from "@/lib/gym-data";
import { useAudio } from "./audio-manager";
import { SpinningBadge } from "./Badge3D";
import { GymTrailInline } from "./gym-trail";
import PixelBox from "./pixel/PixelBox";
import { Pokedex } from "./pokedex";

type TeaserTab = "crawl" | "badges" | "pubdex";

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

// Fill the viewport with the 320px-logical design. PixelScreen's own scale is
// doubled (scale * 2), which is too large here, so we set our own fill scale.
function useFillScale(base = 320, max = 2): number {
	const [scale, setScale] = useState(1);
	useEffect(() => {
		const update = () =>
			setScale(Math.min(max, Math.max(1, window.innerWidth / base)));
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [base, max]);
	return scale;
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

// Press Start font throughout, so text colour is controlled by `text-[...]`.
function TypeBadge({ type }: { type: string }) {
	const meta = TYPE_META[type] ?? TYPE_META.Beer!;
	return (
		<span
			className="shrink-0 inline-block whitespace-nowrap leading-none px-gba-[5] py-gba-[3] border-gba-[2] border-[#282828] text-gba-[7]"
			style={{ background: meta.color, color: meta.fg }}
		>
			{meta.label}
		</span>
	);
}

// Locked / not-yet-earned badge placeholder for the upcoming stops.
function LockedBadge() {
	return (
		<div
			className="size-gba-[22] flex items-center justify-center shrink-0"
			style={{
				background: "#c8d0d8",
				boxShadow: "inset 1px 1px 0 #f8f8f8, inset -1px -1px 0 #a8b0b8",
			}}
		>
			<span className="text-gba-[8] text-[#9aa4ae]">?</span>
		</div>
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
		<PixelBox>
			<div className="text-center text-gba-[8] text-[#d03838] mb-gba-[7]">
				★ CRAWL BEGINS IN ★
			</div>
			<div className="flex justify-center gap-gba-[4]" suppressHydrationWarning>
				{blocks.map(([label, val], i) => (
					<div key={label} className="flex">
						{i > 0 && (
							<span className="self-start text-gba-[14] text-[#282828] mt-gba-[7] mx-gba-[2]">
								:
							</span>
						)}
						<div className="flex flex-col items-center gap-gba-[3]">
							<div
								className="text-center leading-none text-gba-[16] text-[#282828] py-gba-[6] px-gba-[3] w-gba-[44] border-gba-[2] border-[#282828]"
								style={{
									background: "#d8e0e8",
									boxShadow:
										"inset 1px 1px 0 #f8f8f8, inset -1px -1px 0 #a8b0b8",
								}}
							>
								{pad(val)}
							</div>
							<div className="text-gba-[6] text-[#686868]">{label}</div>
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
		<PixelBox variant="blue">
			<div className="text-gba-[7] text-[#f8d030] mb-gba-[6]">▶ FIRST STOP</div>
			<div className="flex items-center gap-gba-[9]">
				<div
					className="shrink-0 p-gba-[4] border-gba-[2] border-[#282828]"
					style={{ background: "#f8f8f8" }}
				>
					<SpinningBadge
						src={gym.badgeSprite}
						className="size-gba-[34]"
						durationMs={2400}
						depth={1}
					/>
				</div>
				<div className="flex-1 min-w-0">
					<div
						className="text-gba-[10] text-[#f8f8f8]"
						style={{ lineHeight: 1.35 }}
					>
						{gym.name}
					</div>
					<div className="flex items-center gap-gba-[6] mt-gba-[5]">
						<TypeBadge type={gym.specialty} />
						<span className="text-gba-[6] text-[#cfe0ff]">
							LEADER {gym.leaderName}
						</span>
					</div>
				</div>
			</div>
			<button
				type="button"
				onClick={() => window.open(dirUrl(gym), "_blank")}
				className="w-full text-center text-gba-[9] text-[#282828] mt-gba-[8] py-gba-[8] border-gba-[3] border-[#a88820] cursor-pointer"
				style={{
					background: "#f8d030",
					boxShadow: "2px 2px 0 rgba(0,0,0,0.25)",
				}}
			>
				GET DIRECTIONS →
			</button>
		</PixelBox>
	);
}

// ── A single upcoming-stop row (white PixelBox, badge blanked) ───────────────
function StopRow({ gym, index }: { gym: Gym; index: number }) {
	return (
		<PixelBox className="flex items-center gap-gba-[6]">
			<span className="shrink-0 w-gba-[16] text-center text-gba-[8] text-[#a8b0b8] leading-none">
				{pad(index)}
			</span>
			<LockedBadge />
			<div className="flex-1 min-w-0 flex flex-col gap-gba-[3]">
				<div className="text-gba-[8] text-[#282828] truncate leading-none">
					{gym.name}
				</div>
				<div className="text-gba-[6] text-[#686868] truncate leading-none">
					LEADER {gym.leaderName}
				</div>
			</div>
			<TypeBadge type={gym.specialty} />
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
			className="flex gap-gba-[4] p-gba-[4] shrink-0 border-b-gba-[3] border-b-[#282828]"
			style={{ background: "#101828" }}
		>
			{tabs.map(([id, label]) => {
				const on = active === id;
				return (
					<button
						key={id}
						type="button"
						onClick={() => onSelect(id)}
						className="flex-1 text-gba-[9] py-gba-[6] border-gba-[2] border-[#282828] cursor-pointer"
						style={{
							background: on ? "#d03838" : "#f8f8f8",
							color: on ? "#f8f8f8" : "#282828",
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
	const { playBGM } = useAudio();
	const scale = useFillScale();

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
		<div
			className="w-full mx-auto flex flex-col h-dvh font-heading"
			style={
				{
					background: "#d8e0e8",
					maxWidth: 320 * scale,
					"--pixel-scale": scale,
				} as CSSProperties
			}
		>
			{/* Header */}
			<div
				className="flex items-center justify-between shrink-0 px-gba-[12] py-gba-[9] border-b-gba-[3] border-b-[#a82828]"
				style={{
					background: "#d03838",
					boxShadow: "inset 0 2px 0 rgba(248,88,88,0.6)",
				}}
			>
				<div style={{ lineHeight: 1.5 }}>
					<div className="text-gba-[11] text-[#f8f8f8]">2026 PUB CRAWL</div>
					<div className="text-gba-[7] text-[#f6c6c6] mt-gba-[3]">
						LAMBETH LEAGUE · {GYMS.length} STOPS
					</div>
				</div>
				<PokeballMark />
			</div>

			<TeaserTabs active={tab} onSelect={setTab} />

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
						onClose={() => setTab("crawl")}
					/>
				</div>
			)}

			{tab === "pubdex" && (
				<div className="flex-1 min-h-0 font-sans">
					<Pokedex
						seenIds={seenIds}
						caughtIds={caughtIds}
						onBack={() => setTab("crawl")}
					/>
				</div>
			)}
		</div>
	);
}
