"use client";

import { useEffect, useState } from "react";
import { PartySocket } from "partysocket";
import { PixelBox } from "@/components/pixel-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GYMS } from "@/lib/gym-data";

interface PlayerStats {
	name: string;
	drinksLogged: number;
	badges: number[];
	partyCount: number;
	tournamentOptIn?: boolean;
}

interface TournamentMatch {
	matchId: string;
	player1SessionId: string;
	player2SessionId: string | null;
	battleId?: string;
	winnerId?: string;
	status: "pending" | "in_progress" | "completed" | "forfeited";
	adminOverride?: boolean;
}

interface TournamentBracket {
	round: number;
	matches: TournamentMatch[];
}

export default function AdminPage() {
	const [adminSecret, setAdminSecret] = useState("");
	const [currentGym, setCurrentGym] = useState("1");
	const [players, setPlayers] = useState<PlayerStats[]>([]);
	const [socket, setSocket] = useState<PartySocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [gamePhase, setGamePhase] = useState<
		"collection" | "tournament" | "hall-of-fame"
	>("collection");
	const [tournamentBracket, setTournamentBracket] =
		useState<TournamentBracket | null>(null);
	const [selectedRibbon, setSelectedRibbon] = useState<string>("");
	const [selectedPlayer, setSelectedPlayer] = useState<string>("");
	const [debugState, setDebugState] = useState<any>(null);

	// Load admin secret from localStorage on mount
	useEffect(() => {
		const saved = localStorage.getItem("pubmon_admin_secret");
		if (saved) {
			setAdminSecret(saved);
		}
	}, []);

	// Save admin secret to localStorage whenever it changes
	useEffect(() => {
		if (adminSecret) {
			localStorage.setItem("pubmon_admin_secret", adminSecret);
		}
	}, [adminSecret]);

	useEffect(() => {
		const ws = new PartySocket({
			host: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787",
			party: "main",
			room: "pubmon",
		});

		ws.addEventListener("open", () => {
			setIsConnected(true);
			console.log("[Admin] Connected to server");
		});

		ws.addEventListener("close", () => {
			setIsConnected(false);
			console.log("[Admin] Disconnected from server");
		});

		ws.addEventListener("message", (event) => {
			try {
				const msg = JSON.parse(event.data);

				if (msg.type === "leaderboard_sync") {
					setPlayers(msg.players);
				} else if (msg.type === "gym_update") {
					setCurrentGym(msg.currentGymId.toString());
				} else if (msg.type === "tournament_start") {
					setGamePhase("tournament");
					setTournamentBracket(msg.bracket);
				} else if (msg.type === "bracket_update") {
					setTournamentBracket(msg.bracket);
				} else if (msg.type === "hall_of_fame_ready") {
					setGamePhase("hall-of-fame");
				} else if (msg.type === "admin_state") {
					setDebugState(msg.state);
				} else if (msg.type === "error") {
					alert(`Error: ${msg.message}`);
				}
			} catch (e) {
				console.error("[Admin] Failed to parse message:", e);
			}
		});

		setSocket(ws);

		return () => {
			ws.close();
		};
	}, []);

	const handleSetGym = () => {
		if (!socket || !adminSecret) {
			alert("Please enter admin secret");
			return;
		}

		socket.send(
			JSON.stringify({
				type: "admin_set_gym",
				adminSecret,
				gymId: Number.parseInt(currentGym),
			}),
		);
	};

	const handleStartTournament = () => {
		if (!socket || !adminSecret) {
			alert("Please enter admin secret");
			return;
		}

		socket.send(
			JSON.stringify({
				type: "admin_start_tournament",
				adminSecret,
			}),
		);
	};

	const handlePromotePlayer = (matchId: string, sessionId: string) => {
		if (!socket || !adminSecret) return;

		socket.send(
			JSON.stringify({
				type: "admin_promote_player",
				adminSecret,
				matchId,
				sessionId,
			}),
		);
	};

	const handleKickPlayer = (matchId: string, sessionId: string) => {
		if (!socket || !adminSecret) return;

		socket.send(
			JSON.stringify({
				type: "admin_kick_player",
				adminSecret,
				matchId,
				sessionId,
			}),
		);
	};

	const handleAssignRibbon = () => {
		if (!socket || !adminSecret || !selectedPlayer || !selectedRibbon) {
			alert("Please select a player and ribbon");
			return;
		}

		socket.send(
			JSON.stringify({
				type: "admin_assign_ribbon",
				adminSecret,
				sessionId: selectedPlayer,
				ribbonPath: selectedRibbon,
			}),
		);

		alert(`Ribbon assigned to ${selectedPlayer}`);
	};

	const handleTriggerHallOfFame = () => {
		if (!socket || !adminSecret) {
			alert("Please enter admin secret");
			return;
		}

		if (
			!confirm(
				"This will end the tournament and show the Hall of Fame. Continue?",
			)
		) {
			return;
		}

		socket.send(
			JSON.stringify({
				type: "admin_trigger_hall_of_fame",
				adminSecret,
			}),
		);
	};

	const handleRequestState = () => {
		if (!socket || !adminSecret) {
			alert("Please enter admin secret");
			return;
		}

		socket.send(
			JSON.stringify({
				type: "admin_request_state",
				adminSecret,
			}),
		);
	};

	const ribbonOptions = [
		{ value: "/sprites/ribbons/champion-ribbon.png", label: "Champion" },
		{ value: "/sprites/ribbons/effort-ribbon.png", label: "Effort" },
		{
			value: "/sprites/ribbons/expert-battler-ribbon.png",
			label: "Expert Battler",
		},
		{ value: "/sprites/ribbons/legend-ribbon.png", label: "Legend" },
		{
			value: "/sprites/ribbons/best-friends-ribbon.png",
			label: "Best Friends",
		},
		{ value: "/sprites/ribbons/artist-ribbon.png", label: "Artist" },
		{ value: "/sprites/ribbons/careless-ribbon.png", label: "Careless" },
		{ value: "/sprites/ribbons/relax-ribbon.png", label: "Relax" },
		{ value: "/sprites/ribbons/smile-ribbon.png", label: "Smile" },
		{ value: "/sprites/ribbons/snooze-ribbon.png", label: "Snooze" },
	];

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-6xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-4xl font-bold font-pixel text-primary">
						PubMon Admin Dashboard
					</h1>
					<Badge variant={isConnected ? "default" : "destructive"}>
						{isConnected ? "Connected" : "Disconnected"}
					</Badge>
				</div>

				{/* Admin Authentication */}
				<Card>
					<CardHeader>
						<CardTitle>Admin Authentication</CardTitle>
						<CardDescription>
							Enter the admin secret to access control features
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-end gap-4">
							<div className="flex-1">
								<Label htmlFor="admin-secret">Admin Secret</Label>
								<Input
									id="admin-secret"
									type="password"
									value={adminSecret}
									onChange={(e) => setAdminSecret(e.target.value)}
									placeholder="Enter admin secret"
									className="font-mono"
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Gym Control */}
				<Card>
					<CardHeader>
						<CardTitle>Gym Control</CardTitle>
						<CardDescription>
							Set the current active gym for all players
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-end gap-4">
							<div className="flex-1">
								<Label htmlFor="gym-select">Current Gym</Label>
								<Select value={currentGym} onValueChange={setCurrentGym}>
									<SelectTrigger id="gym-select">
										<SelectValue placeholder="Select gym" />
									</SelectTrigger>
									<SelectContent>
										{GYMS.map((gym) => (
											<SelectItem key={gym.id} value={gym.id.toString()}>
												Gym {gym.id} - {gym.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<Button onClick={handleSetGym} disabled={!adminSecret}>
								Update Gym
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Tournament Status */}
				<Card>
					<CardHeader>
						<CardTitle>Tournament Status</CardTitle>
						<CardDescription>
							Current game phase and tournament participation
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="border rounded-lg p-4">
								<p className="text-sm text-muted-foreground mb-1">Game Phase</p>
								<p className="text-2xl font-pixel font-bold capitalize">
									{gamePhase === "hall-of-fame" ? "Hall of Fame" : gamePhase}
								</p>
							</div>
							<div className="border rounded-lg p-4">
								<p className="text-sm text-muted-foreground mb-1">
									Opted In Players
								</p>
								<p className="text-2xl font-pixel font-bold">
									{players.filter((p) => p.tournamentOptIn).length} /{" "}
									{players.length}
								</p>
							</div>
						</div>

						{tournamentBracket && (
							<div className="grid grid-cols-3 gap-4">
								<div className="border rounded-lg p-4">
									<p className="text-sm text-muted-foreground mb-1">
										Current Round
									</p>
									<p className="text-2xl font-pixel font-bold">
										{tournamentBracket.round}
									</p>
								</div>
								<div className="border rounded-lg p-4">
									<p className="text-sm text-muted-foreground mb-1">
										Active Matches
									</p>
									<p className="text-2xl font-pixel font-bold">
										{
											tournamentBracket.matches.filter(
												(m) => m.status === "in_progress",
											).length
										}
									</p>
								</div>
								<div className="border rounded-lg p-4">
									<p className="text-sm text-muted-foreground mb-1">
										Completed Matches
									</p>
									<p className="text-2xl font-pixel font-bold">
										{
											tournamentBracket.matches.filter(
												(m) => m.status === "completed",
											).length
										}{" "}
										/ {tournamentBracket.matches.length}
									</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Tournament Control */}
				<Card>
					<CardHeader>
						<CardTitle>Tournament Control</CardTitle>
						<CardDescription>
							Start the master tournament with opted-in players
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Button
							onClick={handleStartTournament}
							disabled={!adminSecret || gamePhase !== "collection"}
							variant="destructive"
							size="lg"
						>
							{gamePhase === "collection"
								? "Start Tournament"
								: "Tournament Active"}
						</Button>

						{tournamentBracket && (
							<div className="border rounded-lg p-4 mt-4">
								<h3 className="font-bold mb-2">
									Round {tournamentBracket.round} - Bracket Management
								</h3>
								<div className="space-y-2">
									{tournamentBracket.matches.map((match) => (
										<div
											key={match.matchId}
											className="border rounded p-3 bg-muted/50"
										>
											<div className="flex items-center justify-between mb-2">
												<span className="text-sm font-mono">
													{match.matchId}
												</span>
												<Badge
													variant={
														match.status === "completed"
															? "default"
															: match.status === "in_progress"
																? "secondary"
																: "outline"
													}
												>
													{match.status}
												</Badge>
											</div>
											<div className="grid grid-cols-2 gap-2 text-sm">
												<div
													className={`p-2 border rounded ${match.winnerId === match.player1SessionId ? "bg-green-100 font-bold" : ""}`}
												>
													P1: {match.player1SessionId.slice(0, 8)}...
													{match.status !== "completed" && (
														<div className="flex gap-1 mt-1">
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	handlePromotePlayer(
																		match.matchId,
																		match.player1SessionId,
																	)
																}
															>
																Promote
															</Button>
															<Button
																size="sm"
																variant="destructive"
																onClick={() =>
																	handleKickPlayer(
																		match.matchId,
																		match.player1SessionId,
																	)
																}
															>
																Kick
															</Button>
														</div>
													)}
												</div>
												<div
													className={`p-2 border rounded ${match.winnerId === match.player2SessionId ? "bg-green-100 font-bold" : ""}`}
												>
													{match.player2SessionId ? (
														<>
															P2: {match.player2SessionId.slice(0, 8)}...
															{match.status !== "completed" && (
																<div className="flex gap-1 mt-1">
																	<Button
																		size="sm"
																		variant="outline"
																		onClick={() =>
																			handlePromotePlayer(
																				match.matchId,
																				match.player2SessionId!,
																			)
																		}
																	>
																		Promote
																	</Button>
																	<Button
																		size="sm"
																		variant="destructive"
																		onClick={() =>
																			handleKickPlayer(
																				match.matchId,
																				match.player2SessionId!,
																			)
																		}
																	>
																		Kick
																	</Button>
																</div>
															)}
														</>
													) : (
														<span className="text-muted-foreground">BYE</span>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Hall of Fame Control */}
				<Card>
					<CardHeader>
						<CardTitle>Hall of Fame</CardTitle>
						<CardDescription>
							Assign ribbons and trigger the Hall of Fame ceremony
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-1">
								<Label htmlFor="player-select">Player</Label>
								<Select
									value={selectedPlayer}
									onValueChange={setSelectedPlayer}
								>
									<SelectTrigger id="player-select">
										<SelectValue placeholder="Select player" />
									</SelectTrigger>
									<SelectContent>
										{players.map((player) => (
											<SelectItem key={player.name} value={player.name}>
												{player.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="col-span-1">
								<Label htmlFor="ribbon-select">Ribbon</Label>
								<Select
									value={selectedRibbon}
									onValueChange={setSelectedRibbon}
								>
									<SelectTrigger id="ribbon-select">
										<SelectValue placeholder="Select ribbon" />
									</SelectTrigger>
									<SelectContent>
										{ribbonOptions.map((ribbon) => (
											<SelectItem key={ribbon.value} value={ribbon.value}>
												{ribbon.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="col-span-1 flex items-end">
								<Button
									onClick={handleAssignRibbon}
									disabled={!adminSecret || !selectedPlayer || !selectedRibbon}
									className="w-full"
								>
									Assign Ribbon
								</Button>
							</div>
						</div>

						<Button
							onClick={handleTriggerHallOfFame}
							disabled={!adminSecret}
							variant="destructive"
							size="lg"
							className="w-full"
						>
							Trigger Hall of Fame
						</Button>
					</CardContent>
				</Card>

				{/* Player Statistics */}
				<Card>
					<CardHeader>
						<CardTitle>Player Statistics</CardTitle>
						<CardDescription>
							View all active players and their progress
						</CardDescription>
					</CardHeader>
					<CardContent>
						{players.length === 0 ? (
							<p className="text-muted-foreground text-center py-8">
								No players connected
							</p>
						) : (
							<div className="space-y-2">
								{players
									.sort((a, b) => b.drinksLogged - a.drinksLogged)
									.map((player, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
										>
											<div className="flex items-center gap-4">
												<span className="font-pixel text-lg font-bold">
													{idx + 1}.
												</span>
												<div>
													<div className="flex items-center gap-2">
														<p className="font-pixel font-bold">
															{player.name}
														</p>
														{player.tournamentOptIn && (
															<Badge variant="secondary" className="text-xs">
																Tournament
															</Badge>
														)}
													</div>
													<p className="text-sm text-muted-foreground">
														{player.partyCount} PubMon in party
													</p>
												</div>
											</div>
											<div className="flex items-center gap-4">
												<div className="text-right">
													<p className="font-bold">{player.drinksLogged}</p>
													<p className="text-xs text-muted-foreground">
														Drinks
													</p>
												</div>
												<div className="text-right">
													<p className="font-bold">{player.badges.length}</p>
													<p className="text-xs text-muted-foreground">
														Badges
													</p>
												</div>
											</div>
										</div>
									))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Debug State Viewer */}
				<Card>
					<CardHeader>
						<CardTitle>Debug State</CardTitle>
						<CardDescription>
							View the complete server state for debugging
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Button
							onClick={handleRequestState}
							disabled={!adminSecret}
							variant="outline"
						>
							Refresh State
						</Button>

						{debugState && (
							<div className="border rounded-lg p-4 bg-muted/50 overflow-auto max-h-96">
								<pre className="text-xs font-mono">
									{JSON.stringify(debugState, null, 2)}
								</pre>
							</div>
						)}

						{!debugState && (
							<p className="text-muted-foreground text-center py-8">
								Click "Refresh State" to load the server state
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
