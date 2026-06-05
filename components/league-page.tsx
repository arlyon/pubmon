"use client";

import type { PartySocket } from "partysocket";
import { useEffect, useMemo, useState } from "react";
import type {
	TournamentBracket,
	TournamentMatch,
} from "@/machines/pubmon-machine";
import {
	type CeremonyPlayer,
	CeremonyPodiumView,
	type LeaderboardEntry,
	LeaguePageView,
	TournamentFeedView,
	type TournamentMatchView,
} from "./league-page-view";

interface LeaguePageProps {
	socket: PartySocket;
	sessionId: string;
	playerName: string;
	tournamentOptIn: boolean;
	leaderboard: LeaderboardEntry[];
	activeBattle: { battleId: string; opponentName: string } | null;
	gamePhase: "collection" | "tournament" | "hall-of-fame";
	bracket: TournamentBracket | null;
	onBack: () => void;
	onReturnToBattle: () => void;
}

/** Human-readable label for a round based on how many matches it contains. */
function roundLabel(matchCount: number, round: number): string {
	if (matchCount <= 1) return "FINAL";
	if (matchCount === 2) return "SEMIS";
	if (matchCount <= 4) return "QUARTERS";
	return `ROUND ${round}`;
}

/** Map a server bracket match into the view model used by TournamentFeedView. */
function toMatchView(
	match: TournamentMatch,
	idx: number,
	round: string,
	players: Map<string, { name: string; sprite?: string }>,
): TournamentMatchView {
	const a = players.get(match.player1SessionId);
	const b = match.player2SessionId
		? players.get(match.player2SessionId)
		: undefined;

	const winner: "a" | "b" | undefined =
		match.winnerId && match.winnerId === match.player1SessionId
			? "a"
			: match.winnerId && match.winnerId === match.player2SessionId
				? "b"
				: undefined;

	const status: TournamentMatchView["status"] =
		match.status === "in_progress"
			? "live"
			: match.status === "completed" || match.status === "forfeited"
				? "done"
				: "pending";

	return {
		id: match.matchId,
		playerA: { name: a?.name ?? "???", sprite: a?.sprite },
		playerB: {
			name: match.player2SessionId ? (b?.name ?? "???") : "BYE",
			sprite: b?.sprite,
		},
		scoreA: winner === "a" ? 1 : 0,
		scoreB: winner === "b" ? 1 : 0,
		winner,
		status,
		round,
		label: `M${idx + 1}`,
	};
}

export function LeaguePage({
	socket,
	sessionId,
	playerName,
	tournamentOptIn,
	leaderboard,
	activeBattle,
	gamePhase,
	bracket,
	onBack,
	onReturnToBattle,
}: LeaguePageProps) {
	const [optedIn, setOptedIn] = useState(tournamentOptIn);

	// Sync optedIn with prop changes
	useEffect(() => {
		setOptedIn(tournamentOptIn);
	}, [tournamentOptIn]);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);

			if (msg.type === "player_state") {
				if (msg.playerState.sessionId === sessionId) {
					setOptedIn(msg.playerState.tournamentOptIn);
				}
			}
		};

		socket.addEventListener("message", handleMessage);

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, [socket, sessionId]);

	const handleToggleOptIn = () => {
		const newOptIn = !optedIn;

		socket.send(
			JSON.stringify({
				type: "opt_in_tournament",
				sessionId,
				optIn: newOptIn,
			}),
		);

		setOptedIn(newOptIn);
	};

	// Resolve bracket sessionIds back to player names/sprites via the leaderboard.
	const playerMap = useMemo(() => {
		const map = new Map<string, { name: string; sprite?: string }>();
		for (const entry of leaderboard) {
			if (entry.sessionId) {
				map.set(entry.sessionId, { name: entry.name, sprite: entry.sprite });
			}
		}
		return map;
	}, [leaderboard]);

	const tournamentActive =
		gamePhase === "tournament" && !!bracket && bracket.matches.length > 0;

	const { liveMatches, completedMatches, label } = useMemo(() => {
		if (!bracket) {
			return { liveMatches: [], completedMatches: [], label: "" };
		}
		const round = roundLabel(bracket.matches.length, bracket.round);
		const views = bracket.matches.map((m, i) =>
			toMatchView(m, i, round, playerMap),
		);

		// Matches from prior rounds (archived server-side as the bracket
		// advances). Label each by its own round's size so the round filter
		// shows the whole tournament, not just the current bracket.
		const history = bracket.matchHistory ?? [];
		const countByRound = new Map<number, number>();
		for (const m of history) {
			const r = m.round ?? 0;
			countByRound.set(r, (countByRound.get(r) ?? 0) + 1);
		}
		const historyViews = history.map((m, i) =>
			toMatchView(
				m,
				i,
				roundLabel(countByRound.get(m.round ?? 0) ?? 1, m.round ?? 0),
				playerMap,
			),
		);

		return {
			liveMatches: views.filter((v) => v.status === "live"),
			completedMatches: [
				...historyViews,
				...views.filter((v) => v.status !== "live"),
			],
			label: round,
		};
	}, [bracket, playerMap]);

	// Derive the finals podium (1st/2nd/3rd) for the hall-of-fame ceremony from
	// the crowned bracket. 1st = champion, 2nd = the player they beat in the
	// final, 3rd = a semifinal loser (falling back to the leaderboard).
	const ceremony = useMemo(() => {
		if (gamePhase !== "hall-of-fame" || !bracket?.champion) return null;

		const championId = bracket.champion;
		const finalMatch = bracket.matches.find((m) => m.winnerId === championId);
		const runnerUpId = finalMatch
			? finalMatch.player1SessionId === championId
				? finalMatch.player2SessionId
				: finalMatch.player1SessionId
			: null;

		const resolve = (id: string | null | undefined, fallbackName?: string) => {
			if (id) {
				const p = playerMap.get(id);
				if (p) return p;
			}
			return fallbackName ? { name: fallbackName, sprite: undefined } : null;
		};

		const champ = resolve(championId, bracket.championName);
		const runner = resolve(runnerUpId);
		if (!champ || !runner) return null;

		const exclude = new Set(
			[championId, runnerUpId].filter((x): x is string => !!x),
		);
		const semiRound = bracket.round - 1;
		const semiLosers = (bracket.matchHistory ?? [])
			.filter((m) => (m.round ?? -1) === semiRound && m.winnerId)
			.map((m) =>
				m.winnerId === m.player1SessionId
					? m.player2SessionId
					: m.player1SessionId,
			)
			.filter((id): id is string => !!id && !exclude.has(id));
		let thirdId: string | null = semiLosers[0] ?? null;
		if (!thirdId) {
			thirdId =
				leaderboard.find((e) => e.sessionId && !exclude.has(e.sessionId))
					?.sessionId ?? null;
		}
		const third = resolve(thirdId) ?? { name: "—", sprite: undefined };

		const mk = (
			p: { name: string; sprite?: string },
			title: string,
		): CeremonyPlayer => ({ name: p.name, sprite: p.sprite, title });

		return {
			first: mk(champ, "CHAMPION"),
			second: mk(runner, "RUNNER-UP"),
			third: mk(third, "3RD"),
			finalScore: "1 - 0",
			finalDetails: `${champ.name} defeated ${runner.name}`,
		};
	}, [gamePhase, bracket, playerMap, leaderboard]);

	// When a tournament is running, the league tab becomes the tournament hub.
	// The "active battle" alert is handled globally by the shell so it shows on
	// every view, so the feed itself just renders the bracket state.
	if (tournamentActive) {
		return (
			<TournamentFeedView
				liveMatches={liveMatches}
				completedMatches={completedMatches}
				roundLabel={label}
				onBack={onBack}
				playerName={playerName}
				canJoin={!!activeBattle}
				onJoinMatch={onReturnToBattle}
			/>
		);
	}

	// Hall of Fame: show the champions ceremony once a champion is crowned.
	// Falls back to the final-standings list if the podium can't be resolved.
	if (gamePhase === "hall-of-fame" && ceremony) {
		return (
			<CeremonyPodiumView
				first={ceremony.first}
				second={ceremony.second}
				third={ceremony.third}
				finalScore={ceremony.finalScore}
				finalDetails={ceremony.finalDetails}
			/>
		);
	}

	return (
		<LeaguePageView
			playerName={playerName}
			optedIn={optedIn}
			leaderboard={leaderboard}
			activeBattle={activeBattle}
			gamePhase={gamePhase}
			onBack={onBack}
			onReturnToBattle={onReturnToBattle}
			onToggleOptIn={handleToggleOptIn}
		/>
	);
}
