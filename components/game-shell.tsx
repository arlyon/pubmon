"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRandomPubMon, type PubMon, type PubType } from "@/lib/pokemon-data";
import { useAudio } from "./audio-manager";
import { Badge3D } from "./Badge3D";
import { BattleScreen } from "./battle-screen";
import { CollapsibleGymPath } from "./CollapsibleGymPath";
import { DrinkSelect } from "./drink-select";
import PixelTransition, {
	barBlindsTransition,
	circleWipeTransition,
} from "./pixel/PixelTransition";
import { PixelBox } from "./pixel-box";
import { PlayerCreate, type PlayerInfo } from "./player-create";
import { Pokedex } from "./pokedex";
import { StarterSelect } from "./starter-select";
import { TrainerCard } from "./TrainerCard";
import { TeamManagement } from "./team-management";

function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

type GamePhase =
	| "player-create"
	| "starter"
	| "crawl"
	| "battle"
	| "team"
	| "pokedex"
	| "caught"
	| "xp"
	| "badge-reward";

import { PartySocket } from "partysocket";

const socket = new PartySocket({
	host: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787",
	party: "main",
	room: "pubmon",
});

interface GameShellProps {
	initialPlayerState?: any;
	initialGymId?: number;
}

export function GameShell({
	initialPlayerState,
	initialGymId,
}: GameShellProps) {
	const [phase, setPhase] = useState<GamePhase>(
		initialPlayerState
			? initialPlayerState.party.length > 0
				? "crawl"
				: "starter"
			: "player-create",
	);
	const [sessionId, setSessionId] = useState<string>("");
	const [player, setPlayer] = useState<PlayerInfo | null>(
		initialPlayerState
			? {
					name: initialPlayerState.info.name,
					gender: initialPlayerState.info.sprite === "boy" ? "boy" : "girl",
				}
			: null,
	);
	const [team, setTeam] = useState<PubMon[]>(initialPlayerState?.party || []);
	const [activeIdx, setActiveIdx] = useState(
		initialPlayerState?.activeIndex || 0,
	);
	const [wildPokemon, setWildPokemon] = useState<PubMon | null>(null);
	const [battleLog, setBattleLog] = useState<
		Array<{
			pokemon: PubMon;
			startTime: number;
			endTime: number;
			outcome: "win" | "caught" | "run" | "lose";
		}>
	>(initialPlayerState?.battleLog || []);
	const [battleStartTime, setBattleStartTime] = useState<number | null>(null);
	const [xpGained, setXpGained] = useState(0);
	const [caughtPokemon, setCaughtPokemon] = useState<PubMon | null>(null);
	const [awardedBadgeId, setAwardedBadgeId] = useState<number | null>(null);
	const drinksCollected = battleLog.length;
	// Derive seenIds and caughtIds from battle log
	const seenIds = new Set(battleLog.map((entry) => entry.pokemon.id));
	const caughtIds = new Set(
		battleLog
			.filter((entry) => entry.outcome === "caught")
			.map((entry) => entry.pokemon.id),
	);
	const [showBattleTransition, setShowBattleTransition] = useState(false);
	const [currentGymId, setCurrentGymId] = useState(initialGymId || 1);
	const [badges, setBadges] = useState<Set<number>>(
		initialPlayerState ? new Set(initialPlayerState.badges) : new Set(),
	);
	const { playBGM, stopBGM } = useAudio();

	console.log(battleLog);

	// Initialize or retrieve sessionId from cookie
	useEffect(() => {
		const getCookie = (name: string) => {
			const value = `; ${document.cookie}`;
			const parts = value.split(`; ${name}=`);
			if (parts.length === 2) return parts.pop()?.split(";").shift();
		};

		const setCookie = (name: string, value: string, days: number = 365) => {
			const expires = new Date();
			expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
			document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
		};

		const stored = getCookie("pubmon_session_id");
		if (stored) {
			setSessionId(stored);
		} else {
			const newId = generateUUID();
			setCookie("pubmon_session_id", newId);
			setSessionId(newId);
		}
	}, []);

	// Check if session has existing player when sessionId is loaded (only if not pre-loaded server-side)
	useEffect(() => {
		if (!sessionId || initialPlayerState) return;

		// Send check_session message
		socket.send(
			JSON.stringify({
				type: "check_session",
				sessionId,
			}),
		);

		// Listen for response
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "player_state") {
				// Player exists, restore state
				const playerState = msg.playerState;
				setPlayer({
					name: playerState.info.name,
					gender: playerState.info.sprite === "boy" ? "boy" : "girl",
				});
				setTeam(playerState.party);
				setActiveIdx(playerState.activeIndex);
				setBattleLog(playerState.battleLog || []);
				setBadges(new Set(playerState.badges));

				// Determine phase based on player state
				if (playerState.party.length === 0) {
					setPhase("starter");
				} else {
					setPhase("crawl");
				}

				socket.removeEventListener("message", handleMessage);
			} else if (msg.type === "name_status") {
				// No existing player, stay in player-create phase
				socket.removeEventListener("message", handleMessage);
			}
		};

		socket.addEventListener("message", handleMessage);

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, [sessionId, initialPlayerState]);

	// Play music based on game phase
	useEffect(() => {
		if (showBattleTransition || phase === "battle") {
			playBGM("battle");
		} else if (phase === "crawl" || phase === "pokedex" || phase === "team") {
			playBGM("route-1");
		} else {
			stopBGM();
		}
	}, [showBattleTransition, phase, playBGM, stopBGM]);

	const handlePlayerCreate = useCallback(
		(info: PlayerInfo, existingState?: any) => {
			setPlayer(info);

			if (existingState) {
				// Restore full player state
				setTeam(existingState.party);
				setActiveIdx(existingState.activeIndex);
				setBattleLog(existingState.battleLog || []);
				setBadges(new Set(existingState.badges));

				// Skip to crawl if they have a team, otherwise go to starter
				if (existingState.party.length > 0) {
					setPhase("crawl");
				} else {
					setPhase("starter");
				}
			} else {
				// New player, go to starter selection
				setPhase("starter");
			}
		},
		[],
	);

	const handleStarterSelect = useCallback(
		(pokemon: PubMon) => {
			// Send select_starter message to server
			socket.send(
				JSON.stringify({
					type: "select_starter",
					sessionId,
					pubmonId: pokemon.id,
				}),
			);

			setTeam([pokemon]);
			setActiveIdx(0);
			setPhase("crawl");
		},
		[sessionId],
	);

	const handleDrinkSelect = useCallback(
		(type: PubType) => {
			// Send order_drink message to server
			socket.send(
				JSON.stringify({
					type: "order_drink",
					sessionId,
					drinkType: type,
				}),
			);

			// Listen for encounter_result
			const handleMessage = (event: MessageEvent) => {
				const msg = JSON.parse(event.data);
				if (msg.type === "encounter_result") {
					setWildPokemon(msg.wildPubmon);
					setShowBattleTransition(true);
					socket.removeEventListener("message", handleMessage);
				}
			};

			socket.addEventListener("message", handleMessage);
		},
		[sessionId],
	);

	const handleBattleTransitionMidpoint = useCallback(() => {
		setPhase("battle");
		setBattleStartTime(Date.now());
	}, []);

	const handleBattleTransitionComplete = useCallback(() => {
		setShowBattleTransition(false);
	}, []);

	const handleCatch = useCallback(() => {
		if (!wildPokemon || !battleStartTime) return;

		const battleEndTime = Date.now();

		// Send catch_attempt message to server with timing
		socket.send(
			JSON.stringify({
				type: "catch_attempt",
				sessionId,
				pubmonId: wildPokemon.id,
				battleStartTime,
				battleEndTime,
			}),
		);

		// Listen for catch_result - stay on battle screen until response
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "catch_result") {
				setWildPokemon(null);
				if (msg.success && msg.pubmon) {
					setCaughtPokemon(msg.pubmon);
					setTeam((prev) => [...prev, msg.pubmon]);
					// Battle log will be updated from server via player_state
					setPhase("caught");
				} else {
					// Handle failed catch - return to crawl
					setPhase("crawl");
				}
				socket.removeEventListener("message", handleMessage);
			}
		};

		socket.addEventListener("message", handleMessage);
		// Note: Battle screen stays visible until server responds
	}, [wildPokemon, sessionId, battleStartTime]);

	const handleRun = useCallback(() => {
		if (!wildPokemon || !battleStartTime) return;

		const battleEndTime = Date.now();

		// Send run message to server with timing
		socket.send(
			JSON.stringify({
				type: "run",
				sessionId,
				pubmonId: wildPokemon.id,
				battleStartTime,
				battleEndTime,
			}),
		);

		// Listen for player_state confirmation before transitioning
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "player_state") {
				// Battle log updated, safe to transition
				setWildPokemon(null);
				setPhase("crawl");
				socket.removeEventListener("message", handleMessage);
			}
		};

		socket.addEventListener("message", handleMessage);
		// Note: Battle screen stays visible until server confirms
	}, [battleStartTime, wildPokemon, sessionId]);

	const handleBattleEnd = useCallback(
		(result: "win" | "loss") => {
			if (!wildPokemon || !battleStartTime) return;

			const battleEndTime = Date.now();

			if (result === "win") {
				// Notify server of win - stay on battle screen until response
				socket.send(
					JSON.stringify({
						type: "fight",
						sessionId,
						pubmonId: wildPokemon.id,
						outcome: "win",
						battleStartTime,
						battleEndTime,
					}),
				);

				// Listen for fight_result - will transition when received
				const handleMessage = (event: MessageEvent) => {
					const msg = JSON.parse(event.data);
					if (msg.type === "fight_result") {
						setXpGained(msg.xpGained);
						setTeam(msg.updatedParty);
						setWildPokemon(null);

						// Check if a badge was awarded
						if (msg.awardedBadgeId) {
							setAwardedBadgeId(msg.awardedBadgeId);
							setBadges((prev) => new Set([...prev, msg.awardedBadgeId]));
							setPhase("badge-reward");
						} else {
							setPhase("xp");
						}

						socket.removeEventListener("message", handleMessage);
					}
				};

				socket.addEventListener("message", handleMessage);
				// Note: Battle screen stays visible until server responds
			} else {
				// Loss - send to server and wait for confirmation
				socket.send(
					JSON.stringify({
						type: "fight",
						outcome: "lose",
						sessionId,
						pubmonId: wildPokemon.id,
						battleStartTime,
						battleEndTime,
					}),
				);

				// Listen for player_state confirmation
				const handleMessage = (event: MessageEvent) => {
					const msg = JSON.parse(event.data);
					if (msg.type === "player_state") {
						setWildPokemon(null);
						setPhase("crawl");
						socket.removeEventListener("message", handleMessage);
					}
				};

				socket.addEventListener("message", handleMessage);
				// Note: Battle screen stays visible until server confirms
			}
		},
		[battleStartTime, wildPokemon, sessionId],
	);

	const handleSetActiveMon = useCallback(
		(idx: number) => {
			// Send set_active_mon message to server
			socket.send(
				JSON.stringify({
					type: "set_active_mon",
					sessionId,
					activeIndex: idx,
				}),
			);

			// Listen for player_state response
			const handleMessage = (event: MessageEvent) => {
				const msg = JSON.parse(event.data);
				if (msg.type === "player_state") {
					setActiveIdx(msg.playerState.activeIndex);
					socket.removeEventListener("message", handleMessage);
				}
			};

			socket.addEventListener("message", handleMessage);
		},
		[sessionId],
	);

	// Debug: Log when currentGymId changes
	useEffect(() => {
		console.log("currentGymId changed to:", currentGymId);
	}, [currentGymId]);

	// Listen for gym updates and player state updates from server
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			console.log("Received message:", msg.type, msg);

			if (msg.type === "gym_update" && msg.currentGymId != null) {
				console.log("Setting gym from gym_update:", msg.currentGymId);
				setCurrentGymId(msg.currentGymId);
			}

			// Global listener for player_state updates
			if (msg.type === "player_state" && msg.playerState) {
				console.log("Updating player state:", msg.playerState);
				setBattleLog(msg.playerState.battleLog || []);
				setBadges(new Set(msg.playerState.badges));
				setTeam(msg.playerState.party);
				setActiveIdx(msg.playerState.activeIndex);
			}
		};

		socket.addEventListener("message", handleMessage);

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, []);

	const activePokemon = team.length > 0 ? team[activeIdx] : null;

	return (
		<div className="flex flex-col relative h-screen bg-pixel-gray-light">
			{/* Battle transition overlay */}
			<div
				className="fixed inset-0 pointer-events-none"
				style={{ zIndex: 1000 }}
			>
				<PixelTransition
					transition={barBlindsTransition()}
					active={showBattleTransition}
					onMidpoint={handleBattleTransitionMidpoint}
					onComplete={handleBattleTransitionComplete}
					width={typeof window !== "undefined" ? window.innerWidth : 400}
					height={typeof window !== "undefined" ? window.innerHeight : 800}
				/>
			</div>

			{/* Main content */}
			<main className="flex-1 flex overflow-y-scroll bg-pixel-gray-light">
				{phase === "player-create" && sessionId && (
					<PlayerCreate
						onComplete={handlePlayerCreate}
						socket={socket}
						sessionId={sessionId}
					/>
				)}

				{phase === "starter" && (
					<StarterSelect onSelect={handleStarterSelect} name={player!.name} />
				)}

				{phase === "crawl" && (
					<DrinkSelect
						onSelect={handleDrinkSelect}
						onSelectGym={setCurrentGymId}
						drinksCollected={drinksCollected}
						badges={badges}
						currentGymId={currentGymId}
					/>
				)}

				{phase === "battle" && wildPokemon && (
					<BattleScreen
						wildPokemon={wildPokemon}
						playerPokemon={activePokemon}
						onFight={() => {}}
						onCatch={handleCatch}
						onRun={handleRun}
						onBattleEnd={handleBattleEnd}
					/>
				)}

				{phase === "team" && (
					<TeamManagement
						team={team}
						onBack={() => setPhase("crawl")}
						onSetActive={handleSetActiveMon}
						activeIndex={activeIdx}
					/>
				)}

				{phase === "pokedex" && (
					<Pokedex
						seenIds={seenIds}
						caughtIds={caughtIds}
						onBack={() => setPhase("crawl")}
					/>
				)}

				{phase === "caught" && caughtPokemon && (
					<div className="max-w-md mx-auto flex flex-col items-center gap-4 pt-8">
						<PixelBox variant="battle" className="w-full">
							<div className="flex flex-col items-center gap-4 py-4">
								<div
									className="w-24 h-24 border-2 flex items-center justify-center"
									style={{
										borderColor: `var(--type-${caughtPokemon.type})`,
										background: `var(--type-${caughtPokemon.type})22`,
									}}
								>
									<div
										style={{
											animation: "pixel-bounce 1s ease-in-out infinite",
										}}
									>
										<svg
											viewBox="0 0 10 10"
											width={48}
											height={48}
											style={{ imageRendering: "pixelated" }}
										>
											<circle cx={5} cy={5} r={4.5} fill="#e43b44" />
											<rect
												x={0.5}
												y={4.5}
												width={9}
												height={1}
												fill="#1a1c2c"
											/>
											<circle
												cx={5}
												cy={5}
												r={4.5}
												fill="none"
												stroke="#1a1c2c"
												strokeWidth={0.5}
											/>
											<rect
												x={0.5}
												y={5}
												width={9}
												height={4.5}
												rx={4.5}
												fill="#f4f4f4"
											/>
											<circle
												cx={5}
												cy={5}
												r={1.2}
												fill="#f4f4f4"
												stroke="#1a1c2c"
												strokeWidth={0.4}
											/>
											<circle cx={5} cy={5} r={0.6} fill="#1a1c2c" />
										</svg>
									</div>
								</div>
								<p className="text-[14px] text-primary text-center">GOTCHA!</p>
								<p className="text-[10px] text-foreground text-center">
									{caughtPokemon.name} was caught!
								</p>
								<p className="text-[8px] text-muted-foreground text-center leading-relaxed">
									{caughtPokemon.description}
								</p>
								<p className="text-[9px] text-foreground">
									{caughtPokemon.name} was added to your team!
								</p>
							</div>
						</PixelBox>
						<button
							type="button"
							onClick={() => setPhase("crawl")}
							className="border-4 border-foreground bg-primary text-primary-foreground px-6 py-3 text-[10px] font-sans shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] hover:brightness-110 transition-all w-full max-w-xs"
						>
							CONTINUE CRAWL
						</button>
					</div>
				)}

				{phase === "badge-reward" && awardedBadgeId && (
					<Badge3D
						badgeId={awardedBadgeId}
						onContinue={() => {
							setPhase("xp");
							setAwardedBadgeId(null);
						}}
					/>
				)}

				{phase === "xp" && (
					<div className="max-w-md mx-auto flex flex-col items-center gap-4 pt-8">
						<PixelBox variant="battle" className="w-full">
							<div className="flex flex-col items-center gap-4 py-4">
								<p className="text-[14px] text-primary text-center">VICTORY!</p>
								<p className="text-[10px] text-foreground text-center">
									You defeated the wild {wildPokemon?.name}!
								</p>
								<div className="border-2 border-primary/30 px-4 py-2">
									<p className="text-[12px] text-primary">+{xpGained} XP</p>
								</div>
								{activePokemon && (
									<p className="text-[8px] text-muted-foreground text-center">
										{activePokemon.name} gained experience!
									</p>
								)}
							</div>
						</PixelBox>
						<button
							onClick={() => setPhase("crawl")}
							type="button"
							className="border-4 border-foreground bg-primary text-primary-foreground px-6 py-3 text-[10px] font-sans shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] hover:brightness-110 transition-all w-full max-w-xs"
						>
							CONTINUE CRAWL
						</button>
					</div>
				)}
			</main>

			{/* Bottom nav */}
			<nav
				className={`border-t-4 border-pixel-black bg-pixel-white ${phase === "starter" || phase === "player-create" || phase === "battle" ? "hidden" : ""}`}
			>
				<div className="max-w-md mx-auto flex items-stretch">
					<button
						type="button"
						onClick={() => setPhase("crawl")}
						className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer font-pixel transition-colors
              ${phase === "crawl" ? "bg-pixel-blue text-pixel-white" : "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"}
            `}
					>
						<svg
							viewBox="0 0 8 8"
							width={16}
							height={16}
							className="pixel-perfect"
						>
							<rect x={2} y={0} width={4} height={1} fill="currentColor" />
							<rect x={1} y={1} width={6} height={5} fill="currentColor" />
							<rect x={3} y={6} width={2} height={2} fill="currentColor" />
						</svg>
						<span className="text-[5px]">CRAWL</span>
					</button>
					<div className="w-[2px] bg-pixel-gray/30" />
					<button
						onClick={() => setPhase("pokedex")}
						className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer font-pixel transition-colors
              ${phase === "pokedex" ? "bg-pixel-red text-pixel-white" : "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"}
            `}
					>
						<svg
							viewBox="0 0 12 12"
							width={16}
							height={16}
							className="pixel-perfect"
						>
							<rect
								x={0}
								y={0}
								width={12}
								height={12}
								rx={1}
								fill="currentColor"
							/>
							<rect
								x={1}
								y={1}
								width={10}
								height={10}
								rx={1}
								fill="rgb(var(--pixel-white))"
							/>
							<rect
								x={2}
								y={2}
								width={8}
								height={5}
								fill="currentColor"
								opacity={0.3}
							/>
							<rect
								x={3}
								y={8}
								width={6}
								height={1}
								fill="currentColor"
								opacity={0.3}
							/>
						</svg>
						<span className="text-[5px]">PUBDEX</span>
					</button>
					<div className="w-[2px] bg-pixel-gray/30" />
					<button
						onClick={() => setPhase("team")}
						className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer font-pixel transition-colors
              ${phase === "team" ? "bg-pixel-blue text-pixel-white" : "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"}
            `}
					>
						<svg
							viewBox="0 0 10 10"
							width={16}
							height={16}
							className="pixel-perfect"
						>
							<circle
								cx={5}
								cy={5}
								r={4.5}
								fill="none"
								stroke="currentColor"
								strokeWidth={1}
							/>
							<rect x={0.5} y={4.5} width={9} height={1} fill="currentColor" />
							<circle cx={5} cy={5} r={1.5} fill="currentColor" />
						</svg>
						<span className="text-[5px]">PUBMON</span>
					</button>
				</div>
			</nav>
		</div>
	);
}
