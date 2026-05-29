"use client";

import { useMemo, useState } from "react";
import { PixelButton } from "./pixel-box";
import PixelHeader from "./pixel/PixelHeader";
import PixelHPBar from "./pixel/PixelHPBar";

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
	prize: string;
	title: string;
}

export interface LeaguePageViewProps {
	playerName: string;
	optedIn: boolean;
	leaderboard: LeaderboardEntry[];
	activeBattle: { battleId: string; opponentName: string } | null;
	onBack: () => void;
	onReturnToBattle: () => void;
	onToggleOptIn: () => void;
}

export interface TournamentFeedViewProps {
	liveMatches: TournamentMatchView[];
	completedMatches: TournamentMatchView[];
	roundLabel: string;
	onBack: () => void;
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

function BadgeDots({ count, total = 8 }: { count: number; total?: number }) {
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

function PixelCrown() {
	return (
		<svg
			viewBox="0 0 14 8"
			width={28}
			height={16}
			shapeRendering="crispEdges"
		>
			<rect x="0" y="3" width="14" height="3" fill="#f8d030" />
			<rect x="0" y="2" width="2" height="2" fill="#f8d030" />
			<rect x="6" y="2" width="2" height="2" fill="#f8d030" />
			<rect x="12" y="2" width="2" height="2" fill="#f8d030" />
			<rect x="0" y="6" width="14" height="1" fill="#a88820" />
			<rect x="6" y="0" width="2" height="2" fill="#e43b44" />
		</svg>
	);
}

function TrophyIcon({
	size = 18,
	fill = "#f0e070",
}: { size?: number; fill?: string }) {
	return (
		<svg
			viewBox="0 0 12 12"
			width={size}
			height={size}
			shapeRendering="crispEdges"
		>
			<rect x="2" y="1" width="8" height="1" fill={fill} />
			<rect x="2" y="2" width="1" height="4" fill={fill} />
			<rect x="9" y="2" width="1" height="4" fill={fill} />
			<rect x="3" y="2" width="6" height="4" fill={fill} />
			<rect x="0" y="2" width="2" height="2" fill={fill} />
			<rect x="10" y="2" width="2" height="2" fill={fill} />
			<rect x="4" y="6" width="4" height="1" fill="#a88820" />
			<rect x="5" y="7" width="2" height="2" fill={fill} />
			<rect x="3" y="9" width="6" height="1" fill={fill} />
			<rect x="2" y="10" width="8" height="1" fill="#a88820" />
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
	return (
		<div
			className={`bg-[#d0e8f0] border-[3px] border-pixel-black flex items-end justify-center overflow-hidden shrink-0 ${s.outer} ${
				highlight ? "shadow-[0_0_0_2px_#f8d030]" : ""
			}`}
		>
			{sprite ? (
				<img
					src={sprite}
					alt={name}
					className={`pixel-perfect ${s.inner}`}
				/>
			) : (
				<span
					className={`font-heading text-pixel-black flex items-center justify-center w-full h-full ${s.text}`}
				>
					{name.slice(0, 2)}
				</span>
			)}
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
		rank === 1
			? "h-gba-[56]"
			: rank === 2
				? "h-gba-[36]"
				: "h-gba-[24]";

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
	onBack,
	onReturnToBattle,
	onToggleOptIn,
}: LeaguePageViewProps) {
	const sorted = useMemo(
		() => [...leaderboard].sort((a, b) => b.battlesWon - a.battlesWon),
		[leaderboard],
	);

	const top3 = sorted.slice(0, 3);
	const rest = sorted.slice(3);
	const hasPodium = top3.length >= 3;

	const winRate = (e: LeaderboardEntry) =>
		e.totalBattles > 0
			? Math.round((e.battlesWon / e.totalBattles) * 100)
			: 0;

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			<PixelHeader
				title="HALL OF CHAMPS"
				subtitle="LEADERBOARD"
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
					className="font-heading text-gba-[7] flex justify-between px-gba-[8] py-gba-[5]"
					style={{ background: "#101828", color: "#78b8f0" }}
				>
					<span>
						RANKS {hasPodium ? "4" : "1"}–{sorted.length}
					</span>
					<span>QUAL: TOP 8</span>
				</div>

				{/* Tournament opt-in strip */}
				<button
					type="button"
					onClick={onToggleOptIn}
					className="w-full flex items-center justify-between font-heading text-gba-[7] px-gba-[8] py-gba-[6] border-b-[2px] border-pixel-black"
					style={{
						background: optedIn ? "#50b058" : "#fff",
						color: optedIn ? "#fff" : "#282828",
					}}
				>
					<span>
						{optedIn
							? "★ TOURNAMENT: OPTED IN"
							: "TAP TO JOIN TOURNAMENT"}
					</span>
					<span
						className="text-gba-[7] px-gba-[6] py-gba-[2] border-[2px] border-pixel-black"
						style={{
							background: optedIn ? "#fff" : "#d8e0e8",
							color: optedIn ? "#50b058" : "#686868",
						}}
					>
						{optedIn ? "ON" : "OFF"}
					</span>
				</button>

				{(hasPodium ? rest : sorted).map((entry, i) => {
					const rank = (hasPodium ? 4 : 1) + i;
					const isYou = entry.name === playerName;
					const qualified = rank <= 8;
					const wr = winRate(entry);

					return (
						<div
							key={entry.name}
							className="flex items-center font-heading gap-gba-[6] px-gba-[8] py-gba-[4]"
							style={{
								borderBottom:
									rank === 8
										? "2px dashed #d03838"
										: "1px solid rgba(168,176,184,0.5)",
								background: isYou
									? "#fff"
									: qualified
										? "rgba(80,176,88,0.1)"
										: "transparent",
							}}
						>
							<span className="w-gba-[20] shrink-0 text-gba-[9] text-[#686868]">
								{rank}
							</span>
							<div className="shrink-0">
								<PlayerAvatar
									name={entry.name}
									sprite={entry.sprite}
									size={22}
								/>
							</div>
							<div className="flex-1 min-w-0 text-gba-[8]">
								<div className="text-pixel-black truncate">
									{entry.name}
									{isYou && (
										<span className="text-pixel-blue text-gba-[6] ml-gba-[4]">
											(YOU)
										</span>
									)}
								</div>
								<div className="text-gba-[6] text-[#686868] flex items-center gap-gba-[4] mt-gba-[2]">
									{entry.battlesWon}W·
									{entry.totalBattles - entry.battlesWon}L
								</div>
							</div>
							<div className="shrink-0">
								<BadgeDots count={entry.badges.length} />
							</div>
							<span className="w-gba-[28] shrink-0 text-gba-[9] text-pixel-black text-right">
								{wr}%
							</span>
						</div>
					);
				})}

				{/* Cut-line legend */}
				{sorted.length > 8 && (
					<div className="font-heading text-center text-gba-[7] text-[#686868] p-gba-[8] leading-relaxed">
						- - - QUALIFICATION CUT-LINE - - -
						<br />
						TOP 8 ENTER THE TOURNAMENT.
					</div>
				)}

				{sorted.length === 0 && (
					<div className="font-heading text-center text-gba-[8] text-[#686868] py-gba-[20] px-gba-[10]">
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
			className="shrink-0 font-heading text-left text-gba-[7] px-gba-[8] py-gba-[6] leading-tight"
			style={{
				background: active ? color : "#fff",
				color: active ? "#fff" : "#282828",
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

function LiveBattleCard({ match }: { match: TournamentMatchView }) {
	const hpMax = match.hpMax ?? 30;

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
				className="absolute font-heading text-gba-[7] text-pixel-white px-gba-[6] py-gba-[3] border-[2px] border-pixel-black"
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
				<div className="flex flex-col items-center gap-gba-[3]">
					<PlayerAvatar
						name={match.playerA.name}
						sprite={match.playerA.sprite}
						size={42}
					/>
					<div className="font-heading text-gba-[8]">
						{match.playerA.name}
					</div>
					<div className="w-full">
						<PixelHPBar
							current={match.hpA ?? hpMax}
							max={hpMax}
							showNumbers={false}
						/>
					</div>
					<div className="font-heading text-gba-[7]">
						{match.scoreA} WIN
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
				<div className="flex flex-col items-center gap-gba-[3]">
					<PlayerAvatar
						name={match.playerB.name}
						sprite={match.playerB.sprite}
						size={42}
					/>
					<div className="font-heading text-gba-[8]">
						{match.playerB.name}
					</div>
					<div className="w-full">
						<PixelHPBar
							current={match.hpB ?? hpMax}
							max={hpMax}
							showNumbers={false}
						/>
					</div>
					<div className="font-heading text-gba-[7]">
						{match.scoreB} WIN
					</div>
				</div>
			</div>

			{/* Info strip */}
			<div
				className="font-heading text-gba-[7] flex justify-between px-gba-[6] py-gba-[3]"
				style={{ background: "#101828", color: "#78b8f0" }}
			>
				<span>{match.round} · BO3</span>
				<span>{match.label}</span>
				<span>● FIGHTING</span>
			</div>
		</div>
	);
}

function CompletedRow({ match }: { match: TournamentMatchView }) {
	const winA = match.winner === "a";

	return (
		<div
			className="flex items-center bg-pixel-white font-heading gap-gba-[6] px-gba-[8] py-gba-[5]"
			style={{ borderBottom: "1px solid #a8b0b8" }}
		>
			<span className="w-gba-[20] shrink-0 text-gba-[6] text-[#686868]">
				{match.round}
			</span>
			<div
				className="flex-1 flex items-center justify-end gap-gba-[4]"
				style={{ opacity: winA ? 1 : 0.5 }}
			>
				<span className="text-gba-[8]">{match.playerA.name}</span>
				<PlayerAvatar
					name={match.playerA.name}
					sprite={match.playerA.sprite}
					size={20}
				/>
			</div>
			<div
				className="w-gba-[36] shrink-0 text-center text-gba-[8] text-pixel-yellow px-gba-[5] py-gba-[2]"
				style={{ background: "#282828" }}
			>
				{match.scoreA}-{match.scoreB}
			</div>
			<div
				className="flex-1 flex items-center gap-gba-[4]"
				style={{ opacity: winA ? 0.5 : 1 }}
			>
				<PlayerAvatar
					name={match.playerB.name}
					sprite={match.playerB.sprite}
					size={20}
				/>
				<span className="text-gba-[8]">{match.playerB.name}</span>
			</div>
			<span
				className="text-gba-[8] shrink-0"
				style={{ color: winA ? "#206020" : "#a02020" }}
			>
				{winA ? "←W" : "W→"}
			</span>
		</div>
	);
}

export function TournamentFeedView({
	liveMatches,
	completedMatches,
	roundLabel,
	onBack,
}: TournamentFeedViewProps) {
	const [roundFilter, setRoundFilter] = useState("ALL");

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
			<div
				className="font-heading flex justify-between items-center px-gba-[10] py-gba-[8] border-b-[3px] border-pixel-black"
				style={{
					background: "#d03838",
					boxShadow:
						"inset 2px 2px 0 rgba(255,255,255,0.25), inset -2px -2px 0 rgba(0,0,0,0.25)",
				}}
			>
				<div className="flex items-center gap-gba-[8]">
					<TrophyIcon size={20} fill="#f8d030" />
					<div className="leading-relaxed">
						<div className="text-gba-[10] text-pixel-white">
							THE TOURNAMENT
						</div>
						<div className="text-gba-[7] text-pixel-white opacity-85">
							{roundLabel}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-gba-[8]">
					{liveMatches.length > 0 && (
						<span
							className="font-heading text-gba-[7] text-pixel-red px-gba-[4] py-gba-[2] border-[2px] border-pixel-white"
							style={{ background: "#fff" }}
						>
							● LIVE
						</span>
					)}
					<button
						type="button"
						onClick={onBack}
						className="font-heading text-gba-[7] text-pixel-white"
					>
						← BACK
					</button>
				</div>
			</div>

			{/* Live section */}
			{liveMatches.length > 0 && (
				<div
					className="flex flex-col p-gba-[8] gap-gba-[8] border-b-[3px] border-pixel-black"
					style={{ background: "#fef0f0" }}
				>
					<div className="flex justify-between items-center">
						<div className="font-heading text-gba-[9] text-[#a82828]">
							● ACTIVE NOW
						</div>
						<div className="font-heading text-gba-[7] text-[#a82828]">
							{liveMatches.length} BATTLE
							{liveMatches.length !== 1 ? "S" : ""}
						</div>
					</div>
					{liveMatches.map((m) => (
						<LiveBattleCard key={m.id} match={m} />
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
				<div className="font-heading text-gba-[8] flex justify-between px-gba-[8] py-gba-[5] border-b-[2px] border-pixel-black bg-pixel-gray-light">
					<span>COMPLETED</span>
					<span className="text-[#686868]">
						{filtered.length} MATCHES
					</span>
				</div>
				{filtered.map((m) => (
					<CompletedRow key={m.id} match={m} />
				))}
				{filtered.length === 0 && (
					<div className="font-heading text-center text-gba-[8] text-[#686868] py-gba-[20] px-gba-[10]">
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

function Confetti({ count = 40 }: { count?: number }) {
	const items = useMemo(
		() =>
			Array.from({ length: count }).map((_, i) => ({
				x: Math.floor(Math.random() * 100),
				delay: Math.random() * 1.5,
				color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
				size: 2 + Math.floor(Math.random() * 3),
				duration: 2.4 + Math.random() * 1.5,
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
						top: -20,
						width: p.size,
						height: p.size,
						background: p.color,
						animation: `confetti-fall ${p.duration}s steps(8,end) ${p.delay}s infinite`,
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
			<div className="font-heading text-gba-[7] text-[#a88820] mb-gba-[4]">
				────── CONGRATULATIONS ──────
			</div>
			<div
				className="font-heading text-gba-[18] text-pixel-black tracking-wide leading-tight"
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
		rank === 1
			? "h-gba-[64]"
			: rank === 2
				? "h-gba-[42]"
				: "h-gba-[28]";

	return (
		<div className="flex flex-col items-center flex-1 gap-gba-[4]">
			{rank === 1 && <PixelCrown />}
			<div
				className={`bg-[#d0e8f0] border-[3px] border-pixel-black flex items-end justify-center overflow-hidden ${AVATAR[avatarSize].outer} ${
					rank === 1
						? "shadow-[0_0_0_3px_#f8d030,2px_2px_0_0_rgba(0,0,0,0.3)]"
						: "shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
				}`}
				style={{
					animation:
						rank === 1
							? "pixel-bounce 1.4s steps(4,end) infinite"
							: "none",
				}}
			>
				{player.sprite ? (
					<img
						src={player.sprite}
						alt={player.name}
						className={`pixel-perfect ${AVATAR[avatarSize].inner}`}
					/>
				) : (
					<span
						className={`font-heading text-pixel-black flex items-center justify-center w-full h-full ${AVATAR[avatarSize].text}`}
					>
						{player.name.slice(0, 2)}
					</span>
				)}
			</div>
			<div className="font-heading text-gba-[9] text-pixel-black">
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
				<div className="font-heading text-gba-[6] text-pixel-black opacity-85">
					{player.title}
				</div>
			</div>
			<div className="font-heading text-gba-[7] text-[#206020] mt-gba-[2]">
				{player.prize}
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
			<div
				className="font-heading flex justify-between items-center px-gba-[10] py-gba-[8] border-b-[3px] border-pixel-black"
				style={{
					background: "#262b44",
					boxShadow:
						"inset 2px 2px 0 rgba(255,255,255,0.25), inset -2px -2px 0 rgba(0,0,0,0.25)",
				}}
			>
				<div className="flex items-center gap-gba-[8]">
					<TrophyIcon size={22} fill="#f8d858" />
					<div className="leading-relaxed">
						<div className="text-gba-[10] text-[#f8d858]">
							HALL OF FAME
						</div>
						<div className="text-gba-[7] text-[#a8c8f0] opacity-85">
							LEAGUE FINALS
						</div>
					</div>
				</div>
				<span className="text-gba-[7] text-[#a8c8f0]">★★★</span>
			</div>

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
							boxShadow:
								"inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8",
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
								<span className="font-heading text-gba-[8]">
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
								<span className="font-heading text-gba-[8]">
									{second.name}
								</span>
							</div>
						</div>
						<div className="font-heading text-center text-gba-[7] text-[#686868]">
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
