"use client";

import type { PartySocket } from "partysocket";
import { useEffect, useState } from "react";
import type {
	TournamentBracket,
	TournamentMatch,
} from "@/src/types/game-state";
import { PixelBox } from "./pixel-box";

interface PlayerInfo {
	name: string;
	sprite: string;
}

interface TournamentBracketViewerProps {
	socket: PartySocket;
	sessionId: string;
	initialBracket?: TournamentBracket;
}

export function TournamentBracketViewer({
	socket,
	sessionId,
	initialBracket,
}: TournamentBracketViewerProps) {
	const [bracket, setBracket] = useState<TournamentBracket | null>(
		initialBracket || null,
	);
	const [players, setPlayers] = useState<Map<string, PlayerInfo>>(new Map());

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);

			if (msg.type === "tournament_start") {
				setBracket(msg.bracket);
			} else if (msg.type === "bracket_update") {
				setBracket(msg.bracket);
			} else if (msg.type === "leaderboard_sync") {
				// Extract player info from leaderboard
				const playerMap = new Map<string, PlayerInfo>();
				msg.players.forEach((p: any) => {
					// We don't have sessionId in leaderboard, this is a limitation
					// In production, we'd need to enhance the message
					playerMap.set(p.name, {
						name: p.name,
						sprite: "boy", // Default
					});
				});
				setPlayers(playerMap);
			}
		};

		socket.addEventListener("message", handleMessage);

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, [socket]);

	if (!bracket) {
		return (
			<div className="max-w-md mx-auto flex flex-col items-center gap-4 pt-8">
				<PixelBox variant="battle" className="w-full">
					<div className="flex flex-col items-center gap-4 py-8">
						<p className="text-[14px] text-primary">MASTER LEAGUE TOURNAMENT</p>
						<p className="text-[10px] text-muted-foreground text-center px-4">
							The tournament has not started yet. Please wait for the admin to
							begin the competition.
						</p>
					</div>
				</PixelBox>
			</div>
		);
	}

	// Find current player's match
	const myMatch = bracket.matches.find(
		(m) => m.player1SessionId === sessionId || m.player2SessionId === sessionId,
	);

	const getMatchStatus = (match: TournamentMatch) => {
		if (match.status === "completed") {
			if (match.winnerId === sessionId) {
				return { text: "YOU WON!", color: "text-green-600" };
			} else if (match.winnerId) {
				return { text: "DEFEATED", color: "text-red-600" };
			}
		}
		if (match.status === "in_progress") {
			return { text: "IN PROGRESS", color: "text-yellow-600" };
		}
		if (match.status === "pending") {
			return { text: "WAITING...", color: "text-gray-600" };
		}
		return { text: "FORFEITED", color: "text-gray-500" };
	};

	return (
		<div className="max-w-md mx-auto flex flex-col gap-4 p-4">
			<div className="text-center">
				<h1 className="text-[14px]  text-primary">MASTER LEAGUE TOURNAMENT</h1>
				<p className="text-[8px] text-muted-foreground">
					Round {bracket.round}
				</p>
			</div>

			{myMatch && (
				<PixelBox variant="battle" className="w-full">
					<div className="p-4">
						<p className="text-[10px] font-bold mb-2">YOUR MATCH</p>
						<div className="flex flex-col gap-2">
							<div
								className={`flex items-center justify-between p-2 border-2 ${
									myMatch.player1SessionId === sessionId
										? "border-primary bg-primary/10"
										: "border-foreground"
								}`}
							>
								<p className="text-[9px] font-bold">
									{myMatch.player1SessionId === sessionId ? "YOU" : "Opponent"}
								</p>
								{myMatch.winnerId === myMatch.player1SessionId && (
									<span className="text-[8px] text-green-600">✓ WIN</span>
								)}
							</div>
							<p className="text-[8px] text-center">VS</p>
							<div
								className={`flex items-center justify-between p-2 border-2 ${
									myMatch.player2SessionId === sessionId
										? "border-primary bg-primary/10"
										: "border-foreground"
								}`}
							>
								<p className="text-[9px] font-bold">
									{myMatch.player2SessionId === sessionId
										? "YOU"
										: myMatch.player2SessionId
											? "Opponent"
											: "BYE"}
								</p>
								{myMatch.winnerId === myMatch.player2SessionId && (
									<span className="text-[8px] text-green-600">✓ WIN</span>
								)}
							</div>
						</div>
						<div className="mt-3 text-center">
							<p
								className={`text-[10px] font-bold ${getMatchStatus(myMatch).color}`}
							>
								{getMatchStatus(myMatch).text}
							</p>
						</div>
					</div>
				</PixelBox>
			)}

			{/* Full Bracket */}
			<PixelBox variant="default" className="w-full">
				<div className="p-2">
					<h2 className="text-[10px] font-bold mb-2 border-b-2 border-foreground pb-1">
						FULL BRACKET
					</h2>
					<div className="space-y-2">
						{bracket.matches.map((match, idx) => (
							<div
								key={match.matchId}
								className="border border-foreground p-2 bg-background"
							>
								<p className="text-[7px] text-muted-foreground mb-1">
									Match {idx + 1}
								</p>
								<div className="flex items-center justify-between text-[8px]">
									<span
										className={
											match.winnerId === match.player1SessionId
												? "font-bold"
												: ""
										}
									>
										P1
									</span>
									<span>vs</span>
									<span
										className={
											match.winnerId === match.player2SessionId
												? "font-bold"
												: ""
										}
									>
										{match.player2SessionId ? "P2" : "BYE"}
									</span>
								</div>
								<p className="text-[7px] text-center mt-1 text-muted-foreground">
									{match.status.toUpperCase()}
								</p>
							</div>
						))}
					</div>
				</div>
			</PixelBox>
		</div>
	);
}
