"use client";

import type { PartySocket } from "partysocket";
import { useEffect, useMemo, useState } from "react";
import type {
	TournamentBracket,
	TournamentMatch,
} from "@/machines/pubmon-machine";
import {
	LeaguePageView,
	TournamentFeedView,
	type LeaderboardEntry,
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
		return {
			liveMatches: views.filter((v) => v.status === "live"),
			completedMatches: views.filter((v) => v.status !== "live"),
			label: round,
		};
	}, [bracket, playerMap]);

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
