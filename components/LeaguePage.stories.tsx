import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
	LeaguePageView,
	TournamentFeedView,
	CeremonyPodiumView,
} from "./league-page-view";
import type {
	LeaderboardEntry,
	TournamentMatchView,
	CeremonyPlayer,
} from "./league-page-view";

// ============================================================================
// MOCK DATA
// ============================================================================

const leaderboard: LeaderboardEntry[] = [
	{
		name: "ASH",
		drinksLogged: 24,
		battlesWon: 42,
		totalBattles: 48,
		badges: [1, 2, 3, 4, 5, 6, 7, 8],
		partyCount: 6,
		level: 56,
		tournamentOptIn: true,
	},
	{
		name: "ROXY",
		drinksLogged: 20,
		battlesWon: 39,
		totalBattles: 48,
		badges: [1, 2, 3, 4, 5, 6, 7, 8],
		partyCount: 6,
		level: 54,
		tournamentOptIn: true,
	},
	{
		name: "KEGGER",
		drinksLogged: 18,
		battlesWon: 36,
		totalBattles: 47,
		badges: [1, 2, 3, 4, 5, 6, 7, 8],
		partyCount: 6,
		level: 52,
	},
	{
		name: "SPLASH",
		drinksLogged: 15,
		battlesWon: 33,
		totalBattles: 45,
		badges: [1, 2, 3, 4, 5, 6, 7],
		partyCount: 5,
		level: 51,
	},
	{
		name: "HOPS",
		drinksLogged: 14,
		battlesWon: 31,
		totalBattles: 45,
		badges: [1, 2, 3, 4, 5, 6, 7],
		partyCount: 5,
		level: 50,
	},
	{
		name: "SHANDY",
		drinksLogged: 13,
		battlesWon: 30,
		totalBattles: 44,
		badges: [1, 2, 3, 4, 5, 6, 7],
		partyCount: 5,
		level: 49,
	},
	{
		name: "PINTS",
		drinksLogged: 11,
		battlesWon: 29,
		totalBattles: 44,
		badges: [1, 2, 3, 4, 5, 6],
		partyCount: 4,
		level: 48,
	},
	{
		name: "TANK",
		drinksLogged: 10,
		battlesWon: 28,
		totalBattles: 45,
		badges: [1, 2, 3, 4, 5, 6],
		partyCount: 4,
		level: 47,
	},
	{
		name: "RUMMY",
		drinksLogged: 9,
		battlesWon: 26,
		totalBattles: 44,
		badges: [1, 2, 3, 4, 5, 6],
		partyCount: 4,
		level: 46,
	},
	{
		name: "DUKE",
		drinksLogged: 8,
		battlesWon: 24,
		totalBattles: 44,
		badges: [1, 2, 3, 4, 5],
		partyCount: 3,
		level: 45,
	},
	{
		name: "PIPER",
		drinksLogged: 7,
		battlesWon: 22,
		totalBattles: 43,
		badges: [1, 2, 3, 4, 5],
		partyCount: 3,
		level: 44,
	},
	{
		name: "CIDER",
		drinksLogged: 6,
		battlesWon: 21,
		totalBattles: 43,
		badges: [1, 2, 3, 4, 5],
		partyCount: 3,
		level: 43,
	},
];

const mobileDecorator = (Story: React.ComponentType) => (
	<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
		<Story />
	</div>
);

// ============================================================================
// 1. LEAGUE PAGE (PODIUM SPOTLIGHT)
// ============================================================================

const leagueMeta = {
	title: "Pages/LeaguePage",
	component: LeaguePageView,
	parameters: { layout: "fullscreen" },
	args: {
		playerName: "SPLASH",
		optedIn: false,
		leaderboard,
		activeBattle: null,
		onBack: fn(),
		onReturnToBattle: fn(),
		onToggleOptIn: fn(),
	},
	decorators: [mobileDecorator],
} satisfies Meta<typeof LeaguePageView>;

export default leagueMeta;
type LeagueStory = StoryObj<typeof leagueMeta>;

export const Default: LeagueStory = {};

export const OptedIn: LeagueStory = {
	args: { optedIn: true },
};

export const WithActiveBattle: LeagueStory = {
	args: {
		optedIn: true,
		activeBattle: { battleId: "battle-abc", opponentName: "ROXY" },
	},
};

export const EmptyLeaderboard: LeagueStory = {
	args: { leaderboard: [] },
};

export const SmallLeaderboard: LeagueStory = {
	args: { leaderboard: leaderboard.slice(0, 2) },
};

// ============================================================================
// 2. TOURNAMENT FEED
// ============================================================================

const liveMatches: TournamentMatchView[] = [
	{
		id: "sf1",
		playerA: { name: "ASH" },
		playerB: { name: "SPLASH" },
		scoreA: 2,
		scoreB: 1,
		status: "live",
		hpA: 28,
		hpB: 5,
		hpMax: 30,
		round: "SF",
		label: "TURN 14",
	},
	{
		id: "sf2",
		playerA: { name: "KEGGER" },
		playerB: { name: "ROXY" },
		scoreA: 1,
		scoreB: 2,
		status: "live",
		hpA: 3,
		hpB: 14,
		hpMax: 30,
		round: "SF",
		label: "TURN 9",
	},
];

const completedMatches: TournamentMatchView[] = [
	{
		id: "r1-1",
		playerA: { name: "ASH" },
		playerB: { name: "CHASER" },
		scoreA: 3,
		scoreB: 0,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M1",
	},
	{
		id: "r1-2",
		playerA: { name: "TANK" },
		playerB: { name: "RUMMY" },
		scoreA: 2,
		scoreB: 1,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M2",
	},
	{
		id: "r1-3",
		playerA: { name: "HOPS" },
		playerB: { name: "CIDER" },
		scoreA: 3,
		scoreB: 1,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M3",
	},
	{
		id: "r1-4",
		playerA: { name: "SPLASH" },
		playerB: { name: "BREW" },
		scoreA: 3,
		scoreB: 0,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M4",
	},
	{
		id: "r1-5",
		playerA: { name: "KEGGER" },
		playerB: { name: "SPIRIT" },
		scoreA: 3,
		scoreB: 2,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M5",
	},
	{
		id: "r1-6",
		playerA: { name: "SHANDY" },
		playerB: { name: "PIPER" },
		scoreA: 2,
		scoreB: 1,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M6",
	},
	{
		id: "r1-7",
		playerA: { name: "PINTS" },
		playerB: { name: "DUKE" },
		scoreA: 3,
		scoreB: 1,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M7",
	},
	{
		id: "r1-8",
		playerA: { name: "ROXY" },
		playerB: { name: "STOUT" },
		scoreA: 3,
		scoreB: 0,
		winner: "a",
		status: "done",
		round: "R1",
		label: "M8",
	},
	{
		id: "qf-1",
		playerA: { name: "ASH" },
		playerB: { name: "TANK" },
		scoreA: 2,
		scoreB: 0,
		winner: "a",
		status: "done",
		round: "QF",
		label: "Q1",
	},
	{
		id: "qf-2",
		playerA: { name: "HOPS" },
		playerB: { name: "SPLASH" },
		scoreA: 1,
		scoreB: 2,
		winner: "b",
		status: "done",
		round: "QF",
		label: "Q2",
	},
	{
		id: "qf-3",
		playerA: { name: "KEGGER" },
		playerB: { name: "SHANDY" },
		scoreA: 2,
		scoreB: 1,
		winner: "a",
		status: "done",
		round: "QF",
		label: "Q3",
	},
	{
		id: "qf-4",
		playerA: { name: "PINTS" },
		playerB: { name: "ROXY" },
		scoreA: 0,
		scoreB: 2,
		winner: "b",
		status: "done",
		round: "QF",
		label: "Q4",
	},
];

export const TournamentFeed = {
	render: () => (
		<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
			<TournamentFeedView
				liveMatches={liveMatches}
				completedMatches={completedMatches}
				roundLabel="ROUND 3 · SEMIFINAL"
				onBack={fn()}
			/>
		</div>
	),
};

export const TournamentFeedNoLive = {
	render: () => (
		<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
			<TournamentFeedView
				liveMatches={[]}
				completedMatches={completedMatches}
				roundLabel="SEMIFINALS COMPLETE"
				onBack={fn()}
			/>
		</div>
	),
};

export const TournamentFeedEmpty = {
	render: () => (
		<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
			<TournamentFeedView
				liveMatches={liveMatches.slice(0, 1)}
				completedMatches={[]}
				roundLabel="ROUND 1 · STARTING"
				onBack={fn()}
			/>
		</div>
	),
};

// ============================================================================
// 3. CEREMONY PODIUM
// ============================================================================

const ceremonyFirst: CeremonyPlayer = {
	name: "ASH",
	prize: "₿ 50,000",
	title: "PUB CHAMPION",
};

const ceremonySecond: CeremonyPlayer = {
	name: "ROXY",
	prize: "₿ 20,000",
	title: "RUNNER-UP",
};

const ceremonyThird: CeremonyPlayer = {
	name: "SPLASH",
	prize: "₿ 10,000",
	title: "THIRD PLACE",
};

export const Ceremony = {
	render: () => (
		<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
			<CeremonyPodiumView
				first={ceremonyFirst}
				second={ceremonySecond}
				third={ceremonyThird}
				finalScore="3—1"
				finalDetails="22 TURNS · 4 KNOCKOUTS · MVP: GEORDIE"
				onReplay={fn()}
				onStats={fn()}
			/>
		</div>
	),
};

export const CeremonyNoButtons = {
	render: () => (
		<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
			<CeremonyPodiumView
				first={ceremonyFirst}
				second={ceremonySecond}
				third={ceremonyThird}
				finalScore="3—2"
				finalDetails="31 TURNS · 7 KNOCKOUTS · MVP: BOULDER"
			/>
		</div>
	),
};
