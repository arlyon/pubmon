"use client";

import type { PartySocket } from "partysocket";
import { useEffect, useState } from "react";
import { PixelBox } from "./pixel-box";

interface LeaderboardEntry {
	name: string;
	drinksLogged: number;
	battlesWon: number;
	totalBattles: number;
	badges: number[];
	partyCount: number;
	level: number;
	tournamentOptIn?: boolean;
}

interface LeaguePageProps {
	socket: PartySocket;
	sessionId: string;
	playerName: string;
	tournamentOptIn: boolean;
	leaderboard: LeaderboardEntry[];
	activeBattle: { battleId: string; opponentName: string } | null;
	onBack: () => void;
	onReturnToBattle: () => void;
}

export function LeaguePage({
	socket,
	sessionId,
	playerName,
	tournamentOptIn,
	leaderboard,
	activeBattle,
	onBack,
	onReturnToBattle,
}: LeaguePageProps) {
	const [optedIn, setOptedIn] = useState(tournamentOptIn);

	console.log(leaderboard);

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

	// Sort leaderboard by battles won
	const sortedLeaderboard = [...leaderboard].sort(
		(a, b) => b.battlesWon - a.battlesWon,
	);

	const trophyAdornments: Record<
		number,
		{ icon: string; bgColor: string; label: string }
	> = {
		0: { icon: "👑", bgColor: "#f8b830", label: "1ST" },
		1: { icon: "🥈", bgColor: "#c0c0c0", label: "2ND" },
		2: { icon: "🥉", bgColor: "#cd7f32", label: "3RD" },
	};

	return (
		<div className="w-full flex flex-col h-full animate-[fade-in_0.3s_ease-out_forwards]">
			{/* Header */}
			<div
				style={{
					background: "#f85858",
					padding: "6px 8px",
					borderBottom: "1px solid #181010",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					fontFamily: "'Press Start 2P', monospace",
				}}
			>
				<button
					type="button"
					onClick={onBack}
					style={{ fontSize: 7, color: "#f8d8d8" }}
				>
					← BACK
				</button>
				<div className="text-center">
					<div style={{ fontSize: 9, color: "#f8f8f8" }}>⚔ LEAGUE TABLE ⚔</div>
					<div style={{ fontSize: 5, color: "#f8d8d8", marginTop: 2 }}>
						SEASON 1 — RANKED BY WINS
					</div>
				</div>
				<div style={{ width: 40 }} /> {/* Spacer */}
			</div>

			{/* Active Battle Alert */}
			{activeBattle && (
				<div className="p-[4px] pt-0">
					<PixelBox
						variant="battle"
						className="w-full bg-[#f85858] animate-pulse"
					>
						<div className="p-[8px] flex flex-col gap-[4px]">
							<div className="font-pixel text-[8px] text-pixel-white text-center">
								⚔ ACTIVE BATTLE ⚔
							</div>
							<div
								className="font-pixel text-pixel-white text-center"
								style={{ fontSize: 6, opacity: 0.9 }}
							>
								VS {activeBattle.opponentName}
							</div>
							<button
								type="button"
								onClick={onReturnToBattle}
								className="mt-[4px] font-pixel text-[7px] bg-pixel-yellow text-pixel-black px-[8px] py-[4px] border-2 border-pixel-white hover:bg-pixel-white transition-colors"
							>
								→ RETURN TO BATTLE
							</button>
						</div>
					</PixelBox>
				</div>
			)}

			{/* Tournament Opt-In */}
			<div className="p-[4px]">
				<PixelBox variant="battle" className="w-full">
					<button
						type="button"
						onClick={handleToggleOptIn}
						className="w-full flex items-center justify-between p-[8px]"
					>
						<div className="text-left">
							<div className="font-pixel text-[8px] text-foreground">
								MASTER TOURNAMENT
							</div>
							<div
								className="font-pixel text-foreground"
								style={{ fontSize: 5, opacity: 0.8 }}
							>
								{optedIn ? "YOU ARE REGISTERED!" : "Opt in to compete"}
							</div>
						</div>
						<div
							className={`w-10 h-5 border-2 border-pixel-white flex items-center p-[2px] transition-colors ${
								optedIn ? "bg-[#78c850]" : "bg-pixel-gray"
							}`}
						>
							<div
								className={`w-4 h-3 bg-pixel-white border-2 border-pixel-black transition-transform ${
									optedIn ? "translate-x-[18px]" : "translate-x-0"
								}`}
							/>
						</div>
					</button>
					{optedIn && (
						<div
							className="mt-[4px] pb-[4px] text-center font-pixel animate-pulse"
							style={{ fontSize: 5, color: "#f8b830" }}
						>
							★ READY FOR THE ULTIMATE CHALLENGE ★
						</div>
					)}
				</PixelBox>
			</div>

			{/* Leaderboard */}
			<div className="flex-1 overflow-y-auto pixel-scroll px-[4px]">
				<div className="flex flex-col gap-[2px] pb-[4px]">
					{sortedLeaderboard.length === 0 ? (
						<PixelBox>
							<p
								className="font-pixel text-pixel-gray text-center py-[16px]"
								style={{ fontSize: 6 }}
							>
								No players yet
							</p>
						</PixelBox>
					) : (
						sortedLeaderboard.map((player, rank) => {
							const trophy = trophyAdornments[rank];
							const isYou = player.name === playerName;
							const winRate =
								player.totalBattles > 0
									? Math.round((player.battlesWon / player.totalBattles) * 100)
									: 0;

							return (
								<PixelBox
									key={rank}
									className={`${isYou ? "border-pixel-yellow border-[3px]" : ""}`}
									style={{
										backgroundColor: trophy
											? trophy.bgColor
											: isYou
												? "#6890f0"
												: "#f8f8f8",
									}}
								>
									<div className="p-[8px]">
										{/* Rank + Name row */}
										<div className="flex items-center justify-between mb-[4px]">
											<div className="flex items-center gap-[8px]">
												<span className="font-pixel text-[8px] w-[16px] text-center">
													{trophy ? trophy.icon : `#${rank + 1}`}
												</span>
												<span
													className={`font-pixel text-[9px] ${
														isYou || trophy
															? "text-pixel-white"
															: "text-pixel-black"
													}`}
												>
													{player.name}
												</span>
												{isYou && (
													<span
														className="font-pixel text-pixel-yellow"
														style={{ fontSize: 5 }}
													>
														(YOU)
													</span>
												)}
											</div>
											<span
												className={`font-pixel text-[8px] ${
													isYou || trophy
														? "text-pixel-white"
														: "text-pixel-gray"
												}`}
											>
												Lv.{player.level}
											</span>
										</div>

										{/* Stats row */}
										<div className="grid grid-cols-4 gap-[4px]">
											<div className="text-center">
												<div
													className={`font-pixel text-[8px] ${
														isYou || trophy
															? "text-pixel-yellow"
															: "text-pixel-black"
													}`}
												>
													{player.battlesWon}
												</div>
												<div
													style={{ fontSize: 4 }}
													className={`font-pixel ${
														isYou || trophy
															? "text-pixel-white opacity-70"
															: "text-pixel-gray"
													}`}
												>
													WINS
												</div>
											</div>
											<div className="text-center">
												<div
													className={`font-pixel text-[8px] ${
														isYou || trophy
															? "text-pixel-white"
															: "text-pixel-black"
													}`}
												>
													{player.totalBattles}
												</div>
												<div
													style={{ fontSize: 4 }}
													className={`font-pixel ${
														isYou || trophy
															? "text-pixel-white opacity-70"
															: "text-pixel-gray"
													}`}
												>
													TOTAL
												</div>
											</div>
											<div className="text-center">
												<div
													className={`font-pixel text-[8px] ${
														isYou || trophy
															? "text-pixel-white"
															: "text-pixel-black"
													}`}
												>
													{winRate}%
												</div>
												<div
													style={{ fontSize: 4 }}
													className={`font-pixel ${
														isYou || trophy
															? "text-pixel-white opacity-70"
															: "text-pixel-gray"
													}`}
												>
													RATE
												</div>
											</div>
											<div className="text-center">
												<div
													className={`font-pixel text-[8px] ${
														isYou || trophy
															? "text-pixel-yellow"
															: "text-pixel-black"
													}`}
												>
													{player.badges.length}★
												</div>
												<div
													style={{ fontSize: 4 }}
													className={`font-pixel ${
														isYou || trophy
															? "text-pixel-white opacity-70"
															: "text-pixel-gray"
													}`}
												>
													BADGES
												</div>
											</div>
										</div>

										{/* Trophy bar for top 3 */}
										{trophy && (
											<div
												className="mt-[4px] text-center font-pixel text-pixel-white"
												style={{ fontSize: 5 }}
											>
												{"═".repeat(8)} {trophy.label} PLACE {"═".repeat(8)}
											</div>
										)}
									</div>
								</PixelBox>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}
