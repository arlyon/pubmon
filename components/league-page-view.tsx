"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GYMS } from "@/lib/gym-data";
import {
	type Gender,
	getTrainerSpritePath,
	resolveTrainerSprite,
} from "@/lib/trainer-sprites";
import PixelHeader from "./pixel/PixelHeader";
import { PixelButton } from "./pixel-box";

// ============================================================================
// TYPES
// ============================================================================

export interface LeaderboardEntry {
	sessionId?: string;
	name: string;
	drinksLogged: number;
	battlesWon: number;
	totalBattles: number;
	badges: number[];
	partyCount: number;
	level: number;
	tournamentOptIn?: boolean;
	sprite?: string;
}

export interface TournamentMatchView {
	id: string;
	playerA: { name: string; sprite?: string };
	playerB: { name: string; sprite?: string };
	scoreA: number;
	scoreB: number;
	winner?: "a" | "b";
	status: "live" | "done" | "pending";
	hpA?: number;
	hpB?: number;
	hpMax?: number;
	round: string;
	label: string;
}

export interface CeremonyPlayer {
	name: string;
	sprite?: string;
	title: string;
}

export interface LeaguePageViewProps {
	playerName: string;
	optedIn: boolean;
	leaderboard: LeaderboardEntry[];
	activeBattle: { battleId: string; opponentName: string } | null;
	gamePhase: "collection" | "tournament" | "hall-of-fame";
	onBack: () => void;
	onReturnToBattle: () => void;
	onToggleOptIn: () => void;
}

export interface TournamentFeedViewProps {
	liveMatches: TournamentMatchView[];
	completedMatches: TournamentMatchView[];
	roundLabel: string;
	onBack: () => void;
	/** Current player's name — used to flag their own live match. */
	playerName?: string;
	/** Whether the player can jump into their live match right now. */
	canJoin?: boolean;
	/** Jump straight into the player's live tournament match. */
	onJoinMatch?: () => void;
}

export interface CeremonyPodiumViewProps {
	first: CeremonyPlayer;
	second: CeremonyPlayer;
	third: CeremonyPlayer;
	finalScore: string;
	finalDetails: string;
	onReplay?: () => void;
	onStats?: () => void;
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

function BadgeDots({
	count,
	total = GYMS.length,
}: {
	count: number;
	total?: number;
}) {
	return (
		<span className="inline-flex gap-[1px]">
			{Array.from({ length: total }).map((_, i) => (
				<span
					key={i}
					className={`inline-block size-gba-[5] border-[1px] border-[#181010] ${
						i < count ? "bg-pixel-yellow" : "bg-pixel-gray"
					}`}
				/>
			))}
		</span>
	);
}

/**
 * Renders text on a single line, auto-scrolling horizontally (ping-pong) only
 * when the content is wider than its container. Prevents leaderboard names from
 * being cropped while keeping short names static.
 */
function MarqueeText({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLSpanElement>(null);
	const [overflow, setOverflow] = useState(0);

	useEffect(() => {
		const measure = () => {
			const c = containerRef.current;
			const t = contentRef.current;
			if (!c || !t) return;
			setOverflow(Math.max(0, t.scrollWidth - c.clientWidth));
		};
		measure();
		const ro = new ResizeObserver(measure);
		if (containerRef.current) ro.observe(containerRef.current);
		if (contentRef.current) ro.observe(contentRef.current);
		return () => ro.disconnect();
	}, [children]);

	const scrolling = overflow > 0;
	// Pace the scroll by distance so long names don't whip past.
	const duration = Math.max(2, overflow / 12 + 1.5);

	return (
		<div ref={containerRef} className={`overflow-hidden ${className ?? ""}`}>
			<span
				ref={contentRef}
				className="inline-block whitespace-nowrap"
				style={
					scrolling
						? {
								animation: `lb-marquee ${duration}s ease-in-out infinite alternate`,
								// expose the scroll distance to the keyframe
								["--lb-shift" as string]: `-${overflow}px`,
							}
						: undefined
				}
			>
				{children}
			</span>
		</div>
	);
}

function PixelCrown() {
	return (
		<svg viewBox="0 0 14 8" width={28} height={16} shapeRendering="crispEdges">
			<rect x="0" y="3" width="14" height="3" fill="#f8d030" />
			<rect x="0" y="2" width="2" height="2" fill="#f8d030" />
			<rect x="6" y="2" width="2" height="2" fill="#f8d030" />
			<rect x="12" y="2" width="2" height="2" fill="#f8d030" />
			<rect x="0" y="6" width="14" height="1" fill="#a88820" />
			<rect x="6" y="0" width="2" height="2" fill="#e43b44" />
		</svg>
	);
}

// Pre-defined avatar sizes — static class names so Tailwind can detect them
const AVATAR = {
	20: {
		outer: "size-gba-[20]",
		inner: "size-gba-[12]",
		text: "text-gba-[6]",
	},
	22: {
		outer: "size-gba-[22]",
		inner: "size-gba-[14]",
		text: "text-gba-[7]",
	},
	28: {
		outer: "size-gba-[28]",
		inner: "size-gba-[20]",
		text: "text-gba-[8]",
	},
	42: {
		outer: "size-gba-[42]",
		inner: "size-gba-[34]",
		text: "text-gba-[12]",
	},
	52: {
		outer: "size-gba-[52]",
		inner: "size-gba-[44]",
		text: "text-gba-[15]",
	},
	56: {
		outer: "size-gba-[56]",
		inner: "size-gba-[48]",
		text: "text-gba-[16]",
	},
	64: {
		outer: "size-gba-[64]",
		inner: "size-gba-[56]",
		text: "text-gba-[18]",
	},
} as const;

type AvatarSize = keyof typeof AVATAR;

function PlayerAvatar({
	name,
	sprite,
	size = 56,
	highlight = false,
}: {
	name: string;
	sprite?: string;
	size?: AvatarSize;
	highlight?: boolean;
}) {
	const s = AVATAR[size];
	// `sprite` carries the player's gender ("boy"/"girl"/"mystery"), not a path.
	// Resolve it (plus any custom name portrait) the same way every other page
	// does via the shared trainer-sprite helpers.
	const gender: Gender =
		sprite === "girl" ? "girl" : sprite === "mystery" ? "mystery" : "boy";
	const spritePath = getTrainerSpritePath(resolveTrainerSprite(name, gender));
	return (
		<div
			className={`bg-[#d0e8f0] border-[3px] border-pixel-black flex items-start justify-center overflow-hidden shrink-0 ${s.outer} ${
				highlight ? "shadow-[0_0_0_2px_#f8d030]" : ""
			}`}
		>
			<img
				src={spritePath}
				alt={name}
				className="pixel-perfect w-full"
				style={{ imageRendering: "pixelated" }}
			/>
		</div>
	);
}

// ============================================================================
// 1. PODIUM SPOTLIGHT — LeaguePageView
// ============================================================================

const PODIUM_COLORS: Record<number, { bg: string; dark: string }> = {
	1: { bg: "#f8d030", dark: "#a88820" },
	2: { bg: "#d8e0e8", dark: "#a8b0b8" },
	3: { bg: "#c28b4a", dark: "#8a5a2a" },
};

function PodiumStep({
	rank,
	entry,
}: {
	rank: 1 | 2 | 3;
	entry: { name: string; sprite?: string; winRate: number };
}) {
	const { bg, dark } = PODIUM_COLORS[rank];
	const heightClass =
		rank === 1 ? "h-gba-[56]" : rank === 2 ? "h-gba-[36]" : "h-gba-[24]";

	return (
		<div className="flex flex-col items-center flex-1 gap-gba-[3]">
			{rank === 1 && (
				<div className="mb-gba-[-4]">
					<PixelCrown />
				</div>
			)}
			<PlayerAvatar
				name={entry.name}
				sprite={entry.sprite}
				size={56}
				highlight={rank === 1}
			/>
			<div className="font-heading text-gba-[9] text-pixel-black">
				{entry.name}
			</div>
			<div className="font-heading text-gba-[7] text-[#686868]">
				{entry.winRate}% WR
			</div>
			<div
				className={`w-full border-t-[3px] border-x-[2px] border-pixel-black flex items-center justify-center ${heightClass}`}
				style={{
					background: bg,
					boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 ${dark}`,
				}}
			>
				<span
					className="font-heading text-gba-[16] text-pixel-black"
					style={{ textShadow: `1px 1px 0 ${dark}` }}
				>
					{rank}
				</span>
			</div>
		</div>
	);
}

export function LeaguePageView({
	playerName,
	optedIn,
	leaderboard,
	activeBattle,
	gamePhase,
	onBack,
	onReturnToBattle,
	onToggleOptIn,
}: LeaguePageViewProps) {
	const concluded = gamePhase === "hall-of-fame";
	const sorted = useMemo(
		() => [...leaderboard].sort((a, b) => b.battlesWon - a.battlesWon),
		[leaderboard],
	);

	const top3 = sorted.slice(0, 3);
	const rest = sorted.slice(3);
	const hasPodium = top3.length >= 3;

	const winRate = (e: LeaderboardEntry) =>
		e.totalBattles > 0 ? Math.round((e.battlesWon / e.totalBattles) * 100) : 0;

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			<PixelHeader
				title="HALL OF CHAMPS"
				subtitle={concluded ? "FINAL STANDINGS" : "LEADERBOARD"}
				variant="dark"
			/>

			{/* Active Battle Alert */}
			{activeBattle && (
				<div
					className="flex items-center justify-between px-gba-[10] py-gba-[6] border-b-[3px] border-pixel-black"
					style={{
						background: "#d03838",
						animation: "pixel-blink 1.2s step-end infinite",
					}}
				>
					<div className="font-heading text-gba-[8] text-pixel-white">
						⚔ VS {activeBattle.opponentName}
					</div>
					<button
						type="button"
						onClick={onReturnToBattle}
						className="font-heading text-gba-[7] text-pixel-yellow px-gba-[6] py-gba-[2] border-[2px] border-pixel-white"
						style={{ background: "#282828" }}
					>
						RETURN →
					</button>
				</div>
			)}

			{/* Podium Hero */}
			{hasPodium && (
				<div
					className="relative px-gba-[12] pt-gba-[16] pb-gba-[10]"
					style={{
						background:
							"linear-gradient(180deg, #262b44 0%, #262b44 60%, #3a4466 100%)",
					}}
				>
					{/* Star sparkles */}
					<div
						className="absolute inset-0 opacity-50 pointer-events-none"
						style={{
							background: [
								"radial-gradient(1px 1px at 12% 16%, #fff, transparent)",
								"radial-gradient(1px 1px at 80% 22%, #f8d858, transparent)",
								"radial-gradient(1px 1px at 42% 8%, #fff, transparent)",
								"radial-gradient(1px 1px at 68% 40%, #fff, transparent)",
								"radial-gradient(1px 1px at 18% 50%, #f8d858, transparent)",
							].join(","),
						}}
					/>
					<div className="flex items-end gap-gba-[4] relative">
						<PodiumStep
							rank={2}
							entry={{
								...top3[1],
								winRate: winRate(top3[1]),
							}}
						/>
						<PodiumStep
							rank={1}
							entry={{
								...top3[0],
								winRate: winRate(top3[0]),
							}}
						/>
						<PodiumStep
							rank={3}
							entry={{
								...top3[2],
								winRate: winRate(top3[2]),
							}}
						/>
					</div>
				</div>
			)}

			{/* Rank list */}
			<div className="flex-1 overflow-y-auto pixel-scroll bg-pixel-gray-light">
				{/* Info strip */}
				<div
					className="font-sans font-palette-blue text-gba-[8] flex justify-between px-gba-[8] py-gba-[5]"
					style={{ background: "#101828" }}
				>
					<span>
						RANKS {hasPodium ? "4" : "1"}–{sorted.length}
					</span>
					<span>
						{concluded
							? "TOURNAMENT OVER"
							: `${sorted.length} TRAINER${sorted.length === 1 ? "" : "S"}`}
					</span>
				</div>

				{/* Tournament opt-in strip — hidden once the tournament has
				    concluded and the hall of fame is live. */}
				{concluded ? (
					<div
						className="w-full flex items-center justify-center font-sans font-palette-yellow text-gba-[8] px-gba-[8] py-gba-[6] border-b-[2px] border-pixel-black"
						style={{ background: "#282828" }}
					>
						★ CHAMPIONS CROWNED — SEE HALL OF FAME
					</div>
				) : (
					<button
						type="button"
						onClick={onToggleOptIn}
						className={`w-full flex items-center justify-between font-sans text-gba-[8] px-gba-[8] py-gba-[6] border-b-[2px] border-pixel-black ${
							optedIn ? "font-palette-white" : "font-palette-default"
						}`}
						style={{ background: optedIn ? "#50b058" : "#fff" }}
					>
						<span>
							{optedIn ? "★ TOURNAMENT: OPTED IN" : "TAP TO JOIN TOURNAMENT"}
						</span>
						<span
							className="font-palette-default text-gba-[7] px-gba-[6] py-gba-[2] border-[2px] border-pixel-black"
							style={{ background: optedIn ? "#fff" : "#d8e0e8" }}
						>
							{optedIn ? "ON" : "OFF"}
						</span>
					</button>
				)}

				{(hasPodium ? rest : sorted).map((entry, i) => {
					const rank = (hasPodium ? 4 : 1) + i;
					const isYou = entry.name === playerName;
					const wr = winRate(entry);

					return (
						<div
							key={entry.name}
							className="flex items-center gap-gba-[6] px-gba-[8] py-gba-[4]"
							style={{
								borderBottom: "1px solid rgba(168,176,184,0.5)",
								background: isYou ? "#fff" : "transparent",
							}}
						>
							<span className="w-gba-[20] shrink-0 font-sans font-palette-muted text-gba-[10] text-center">
								{rank}
							</span>
							<div className="shrink-0">
								<PlayerAvatar
									name={entry.name}
									sprite={entry.sprite}
									size={22}
								/>
							</div>
							<div className="flex-1 min-w-0">
								<MarqueeText className="font-sans font-palette-default text-gba-[9] leading-none">
									{entry.name}
									{isYou && (
										<span
											className="font-palette-blue text-gba-[6] px-gba-[3] py-px ml-gba-[3]"
											style={{ background: "#305098" }}
										>
											YOU
										</span>
									)}
								</MarqueeText>
								<div className="font-sans font-palette-muted text-gba-[7] flex items-center gap-gba-[4] mt-gba-[2] leading-none">
									{entry.battlesWon}W·
									{entry.totalBattles - entry.battlesWon}L
								</div>
							</div>
							<div className="shrink-0">
								<BadgeDots count={entry.badges.length} />
							</div>
							<span className="w-gba-[28] shrink-0 font-sans font-palette-default text-gba-[9] text-right">
								{wr}%
							</span>
						</div>
					);
				})}

				{sorted.length === 0 && (
					<div className="font-sans font-palette-muted text-center text-gba-[9] py-gba-[20] px-gba-[10]">
						NO TRAINERS YET
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// 2. ACTIVE/COMPLETED FEED — TournamentFeedView
// ============================================================================

function RoundChip({
	label,
	count,
	active,
	color = "#4878d0",
	onClick,
}: {
	label: string;
	count: string;
	active: boolean;
	color?: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`shrink-0 font-sans text-left text-gba-[8] px-gba-[8] py-gba-[6] leading-tight ${
				active ? "font-palette-white" : "font-palette-default"
			}`}
			style={{
				background: active ? color : "#fff",
				border: `2px solid ${active ? color : "#282828"}`,
				boxShadow: active
					? "inset 1px 1px 0 rgba(255,255,255,0.4), inset -1px -1px 0 rgba(0,0,0,0.3)"
					: "1px 1px 0 0 rgba(0,0,0,0.2)",
			}}
		>
			{label}
			<br />
			<span className="text-gba-[6] opacity-85">{count}</span>
		</button>
	);
}

function LiveBattleCard({
	match,
	isMine = false,
	canJoin = false,
	onJoin,
}: {
	match: TournamentMatchView;
	isMine?: boolean;
	canJoin?: boolean;
	onJoin?: () => void;
}) {
	return (
		<div
			className="relative flex flex-col p-gba-[8] gap-gba-[6] bg-pixel-white"
			style={{
				border: "3px solid #d03838",
				boxShadow:
					"inset 2px 2px 0 rgba(208,56,56,0.15), inset -2px -2px 0 rgba(208,56,56,0.3), 2px 2px 0 0 rgba(0,0,0,0.2)",
			}}
		>
			{/* Live ribbon */}
			<div
				className="absolute font-sans font-palette-white text-gba-[7] px-gba-[6] py-gba-[3] border-[2px] border-pixel-black"
				style={{
					top: -3,
					left: -3,
					background: "#d03838",
					animation: "pixel-blink 1.2s step-end infinite",
				}}
			>
				● LIVE
			</div>
			<div className="h-gba-[8]" />

			<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-gba-[6]">
				{/* Player A */}
				<div className="flex flex-col items-center gap-gba-[4]">
					<PlayerAvatar
						name={match.playerA.name}
						sprite={match.playerA.sprite}
						size={42}
					/>
					<div className="font-sans font-palette-default text-gba-[9] text-center leading-none">
						{match.playerA.name}
					</div>
				</div>

				{/* VS */}
				<div
					className="font-heading text-gba-[14] text-pixel-red px-gba-[4]"
					style={{ textShadow: "1px 1px 0 #282828" }}
				>
					VS
				</div>

				{/* Player B */}
				<div className="flex flex-col items-center gap-gba-[4]">
					<PlayerAvatar
						name={match.playerB.name}
						sprite={match.playerB.sprite}
						size={42}
					/>
					<div className="font-sans font-palette-default text-gba-[9] text-center leading-none">
						{match.playerB.name}
					</div>
				</div>
			</div>

			{/* Info strip */}
			<div
				className="font-sans font-palette-blue text-gba-[7] flex justify-between px-gba-[6] py-gba-[3]"
				style={{ background: "#101828" }}
			>
				<span>{match.round}</span>
				<span>{match.label}</span>
				<span>{isMine ? "● YOUR MATCH" : "● FIGHTING"}</span>
			</div>

			{/* Jump straight into your own live match */}
			{isMine && canJoin && onJoin && (
				<button
					type="button"
					onClick={onJoin}
					className="w-full font-sans font-palette-white text-gba-[9] px-gba-[8] py-gba-[6] border-[2px] border-pixel-black"
					style={{
						background: "#d03838",
						boxShadow:
							"inset 1px 1px 0 rgba(255,255,255,0.3), inset -1px -1px 0 rgba(0,0,0,0.3)",
						animation: "pixel-blink 1.2s step-end infinite",
					}}
				>
					▶ JOIN YOUR MATCH
				</button>
			)}
		</div>
	);
}

function CompletedRow({ match }: { match: TournamentMatchView }) {
	const winA = match.winner === "a";

	return (
		<div
			className="flex items-center bg-pixel-white gap-gba-[6] px-gba-[8] py-gba-[5]"
			style={{ borderBottom: "1px solid #a8b0b8" }}
		>
			<span className="w-gba-[20] shrink-0 font-sans font-palette-muted text-gba-[6]">
				{match.round}
			</span>
			<div
				className="flex-1 flex items-center justify-end gap-gba-[4] min-w-0"
				style={{ opacity: winA ? 1 : 0.5 }}
			>
				<span className="font-sans font-palette-default text-gba-[9] truncate">
					{match.playerA.name}
				</span>
				<PlayerAvatar
					name={match.playerA.name}
					sprite={match.playerA.sprite}
					size={20}
				/>
			</div>
			<div
				className="w-gba-[36] shrink-0 text-center font-sans font-palette-yellow text-gba-[8] px-gba-[5] py-gba-[2]"
				style={{ background: "#282828" }}
			>
				{match.scoreA}-{match.scoreB}
			</div>
			<div
				className="flex-1 flex items-center gap-gba-[4] min-w-0"
				style={{ opacity: winA ? 0.5 : 1 }}
			>
				<PlayerAvatar
					name={match.playerB.name}
					sprite={match.playerB.sprite}
					size={20}
				/>
				<span className="font-sans font-palette-default text-gba-[9] truncate">
					{match.playerB.name}
				</span>
			</div>
		</div>
	);
}

export function TournamentFeedView({
	liveMatches,
	completedMatches,
	roundLabel,
	playerName,
	canJoin = false,
	onJoinMatch,
}: TournamentFeedViewProps) {
	const [roundFilter, setRoundFilter] = useState("ALL");

	const isMyMatch = (m: TournamentMatchView) =>
		!!playerName &&
		(m.playerA.name === playerName || m.playerB.name === playerName);

	const rounds = useMemo(() => {
		const seen = new Set<string>();
		const order: string[] = [];
		for (const m of completedMatches) {
			if (!seen.has(m.round)) {
				seen.add(m.round);
				order.push(m.round);
			}
		}
		return order;
	}, [completedMatches]);

	const filtered =
		roundFilter === "ALL"
			? completedMatches
			: completedMatches.filter((m) => m.round === roundFilter);

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			{/* Header */}
			<PixelHeader
				title="THE TOURNAMENT"
				subtitle={roundLabel}
				variant="dark"
			/>

			{/* Live section */}
			{liveMatches.length > 0 && (
				<div
					className="flex flex-col p-gba-[8] gap-gba-[8] border-b-[3px] border-pixel-black"
					style={{ background: "#fef0f0" }}
				>
					<div className="flex justify-between items-center">
						<div className="font-sans font-palette-default text-gba-[9]">
							● ACTIVE NOW
						</div>
						<div className="font-sans font-palette-default text-gba-[8]">
							{liveMatches.length} BATTLE
							{liveMatches.length !== 1 ? "S" : ""}
						</div>
					</div>
					{liveMatches.map((m) => (
						<LiveBattleCard
							key={m.id}
							match={m}
							isMine={isMyMatch(m)}
							canJoin={canJoin}
							onJoin={onJoinMatch}
						/>
					))}
				</div>
			)}

			{/* Round filter */}
			<div
				className="flex overflow-x-auto pixel-scroll gap-gba-[4] p-gba-[6] border-b-[2px] border-pixel-black"
				style={{ background: "#101828" }}
			>
				<RoundChip
					label="ALL"
					count={`${completedMatches.length} GAMES`}
					active={roundFilter === "ALL"}
					color="#a8b0b8"
					onClick={() => setRoundFilter("ALL")}
				/>
				{rounds.map((r) => (
					<RoundChip
						key={r}
						label={r}
						count={`${completedMatches.filter((m) => m.round === r).length} MATCHES`}
						active={roundFilter === r}
						onClick={() => setRoundFilter(r)}
					/>
				))}
			</div>

			{/* Completed list */}
			<div className="flex-1 overflow-y-auto pixel-scroll bg-pixel-white">
				<div className="font-sans font-palette-default text-gba-[9] flex justify-between px-gba-[8] py-gba-[5] border-b-[2px] border-pixel-black bg-pixel-gray-light">
					<span>COMPLETED</span>
					<span className="font-palette-muted">{filtered.length} MATCHES</span>
				</div>
				{filtered.map((m) => (
					<CompletedRow key={m.id} match={m} />
				))}
				{filtered.length === 0 && (
					<div className="font-sans font-palette-muted text-center text-gba-[9] py-gba-[20] px-gba-[10]">
						NO MATCHES YET
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// 3. CEREMONY PODIUM — CeremonyPodiumView
// ============================================================================

const CONFETTI_COLORS = [
	"#f8d030",
	"#4878d0",
	"#d03838",
	"#50b058",
	"#f4a4c0",
	"#fff",
];

function Confetti({ count = 100 }: { count?: number }) {
	const items = useMemo(
		() =>
			Array.from({ length: count }).map((_, i) => ({
				x: Math.floor(Math.random() * 100),
				delay: Math.random() * 6,
				color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
				size: 4 + Math.floor(Math.random() * 3),
				duration: 5 + Math.random() * 3,
			})),
		[count],
	);

	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none">
			{items.map((p, i) => (
				<div
					key={i}
					className="absolute"
					style={{
						left: `${p.x}%`,
						top: -200,
						width: p.size,
						height: p.size,
						background: p.color,
						animation: `confetti-fall ${p.duration}s steps(100,end) ${p.delay}s infinite`,
					}}
				/>
			))}
		</div>
	);
}

function ChampionBanner() {
	return (
		<div
			className="relative text-center overflow-hidden px-gba-[12] py-gba-[10]"
			style={{
				background: "#f8d030",
				border: "3px solid #282828",
				boxShadow:
					"inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 #a88820, 2px 2px 0 0 rgba(0,0,0,0.3)",
			}}
		>
			<div className="font-sans font-palette-default text-gba-[8] mb-gba-[4]">
				─── CONGRATULATIONS ───
			</div>
			<div
				className="font-heading text-gba-[13] text-pixel-black tracking-wide leading-tight"
				style={{ textShadow: "2px 2px 0 #a88820" }}
			>
				CHAMPION!
			</div>
		</div>
	);
}

function CeremonyPodiumLane({
	rank,
	player,
	height,
	color,
	dark,
}: {
	rank: 1 | 2 | 3;
	player: CeremonyPlayer;
	height: number;
	color: string;
	dark: string;
}) {
	const avatarSize: AvatarSize = rank === 1 ? 64 : 52;
	const heightClass =
		rank === 1 ? "h-gba-[64]" : rank === 2 ? "h-gba-[42]" : "h-gba-[28]";

	// `player.sprite` carries the gender ("boy"/"girl"); resolve it (plus any
	// custom name portrait) to a real path like every other avatar.
	const gender: Gender =
		player.sprite === "girl"
			? "girl"
			: player.sprite === "mystery"
				? "mystery"
				: "boy";
	const spritePath = getTrainerSpritePath(
		resolveTrainerSprite(player.name, gender),
	);

	return (
		<div className="flex flex-col items-center flex-1 gap-gba-[4]">
			{rank === 1 && <PixelCrown />}
			<div
				className={`bg-[#d0e8f0] border-[3px] border-pixel-black flex items-start justify-center overflow-hidden ${AVATAR[avatarSize].outer} ${
					rank === 1
						? "shadow-[0_0_0_3px_#f8d030,2px_2px_0_0_rgba(0,0,0,0.3)]"
						: "shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
				}`}
				style={{
					animation:
						rank === 1 ? "pixel-bounce 1.4s steps(4,end) infinite" : "none",
				}}
			>
				<img
					src={spritePath}
					alt={player.name}
					className="pixel-perfect w-full"
					style={{ imageRendering: "pixelated" }}
				/>
			</div>
			<div className="font-sans font-palette-default text-gba-[9]">
				{player.name}
			</div>
			<div
				className={`w-full border-[3px] border-pixel-black flex flex-col items-center justify-center ${heightClass}`}
				style={{
					background: color,
					boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.5), inset -2px -2px 0 ${dark}`,
				}}
			>
				<div
					className="font-heading text-gba-[16] text-pixel-black"
					style={{ textShadow: `1px 1px 0 ${dark}` }}
				>
					{rank}
				</div>
			</div>
			<div className="font-sans font-palette-default text-gba-[7] mt-gba-[2]">
				{player.title}
			</div>
		</div>
	);
}

export function CeremonyPodiumView({
	first,
	second,
	third,
	finalScore,
	finalDetails,
	onReplay,
	onStats,
}: CeremonyPodiumViewProps) {
	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			{/* Header */}
			<PixelHeader
				title="HALL OF FAME"
				subtitle="LEAGUE FINALS"
				variant="dark"
				right={
					<span className="font-sans font-palette-yellow text-gba-[8]">
						★★★
					</span>
				}
			/>

			{/* Content with gradient + confetti */}
			<div
				className="flex-1 overflow-y-auto pixel-scroll relative"
				style={{
					background:
						"linear-gradient(180deg, #262b44 0%, #4878d0 60%, #d8e0e8 100%)",
				}}
			>
				<Confetti count={40} />

				<div className="relative flex flex-col p-gba-[10] gap-gba-[12]">
					<ChampionBanner />

					{/* Podium */}
					<div className="flex items-end gap-gba-[4] mt-gba-[4]">
						<CeremonyPodiumLane
							rank={2}
							player={second}
							height={42}
							color="#d8e0e8"
							dark="#a8b0b8"
						/>
						<CeremonyPodiumLane
							rank={1}
							player={first}
							height={64}
							color="#f8d030"
							dark="#a88820"
						/>
						<CeremonyPodiumLane
							rank={3}
							player={third}
							height={28}
							color="#c28b4a"
							dark="#8a5a2a"
						/>
					</div>

					{/* Final score card */}
					<div
						className="flex flex-col p-gba-[8] gap-gba-[6] bg-pixel-white"
						style={{
							border: "3px solid #282828",
							boxShadow: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8",
						}}
					>
						<div className="font-heading text-center text-gba-[8] text-[#a82828]">
							♦ GRAND FINAL ♦
						</div>
						<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-gba-[6]">
							<div className="flex flex-col items-center gap-gba-[3]">
								<PlayerAvatar
									name={first.name}
									sprite={first.sprite}
									size={28}
								/>
								<span className="font-sans font-palette-default text-gba-[9]">
									{first.name}
								</span>
							</div>
							<div
								className="font-heading text-center text-gba-[18] text-pixel-yellow px-gba-[8] py-gba-[4]"
								style={{ background: "#282828" }}
							>
								{finalScore}
							</div>
							<div
								className="flex flex-col items-center gap-gba-[3]"
								style={{ opacity: 0.6 }}
							>
								<PlayerAvatar
									name={second.name}
									sprite={second.sprite}
									size={28}
								/>
								<span className="font-sans font-palette-default text-gba-[9]">
									{second.name}
								</span>
							</div>
						</div>
						<div className="font-sans font-palette-muted text-center text-gba-[8]">
							{finalDetails}
						</div>
					</div>

					{/* CTAs */}
					{(onReplay || onStats) && (
						<div className="flex gap-gba-[6]">
							{onReplay && (
								<PixelButton
									variant="primary"
									onClick={onReplay}
									className="flex-1"
								>
									WATCH REPLAY
								</PixelButton>
							)}
							{onStats && (
								<PixelButton
									variant="primary"
									onClick={onStats}
									className="flex-1"
								>
									FULL STATS
								</PixelButton>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
