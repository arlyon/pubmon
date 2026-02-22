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

interface PlayerStats {
	name: string;
	drinksLogged: number;
	badges: number[];
	partyCount: number;
}

export default function AdminPage() {
	const [adminSecret, setAdminSecret] = useState("");
	const [currentGym, setCurrentGym] = useState("1");
	const [players, setPlayers] = useState<PlayerStats[]>([]);
	const [socket, setSocket] = useState<PartySocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);

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
			host: "http://localhost:8787",
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
										{[1, 2, 3, 4, 5, 6, 7, 8].map((gymId) => (
											<SelectItem key={gymId} value={gymId.toString()}>
												Gym {gymId}
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

				{/* Tournament Control */}
				<Card>
					<CardHeader>
						<CardTitle>Tournament Control</CardTitle>
						<CardDescription>
							Start the master tournament with opted-in players
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleStartTournament}
							disabled={!adminSecret}
							variant="destructive"
							size="lg"
						>
							Start Tournament
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
													<p className="font-pixel font-bold">{player.name}</p>
													<p className="text-sm text-muted-foreground">
														{player.partyCount} PubMon in party
													</p>
												</div>
											</div>
											<div className="flex items-center gap-4">
												<div className="text-right">
													<p className="font-bold">{player.drinksLogged}</p>
													<p className="text-xs text-muted-foreground">Drinks</p>
												</div>
												<div className="text-right">
													<p className="font-bold">{player.badges.length}</p>
													<p className="text-xs text-muted-foreground">Badges</p>
												</div>
											</div>
										</div>
									))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
