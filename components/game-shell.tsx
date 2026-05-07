"use client";

import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ALL_PUBMON,
	getRandomPubMon,
	type PubMon,
	type PubType,
} from "@/lib/pokemon-data";
import { pubmonMachine } from "@/machines/pubmon-machine";
import { useAudio } from "./audio-manager";
import { Badge3D } from "./Badge3D";
import { BattleScreen } from "./battle-screen";
import { CollapsibleGymPath } from "./CollapsibleGymPath";
import { DebugPanel } from "./debug-panel";
import { DrinkSelect } from "./drink-select";
import { GameNavbar } from "./game-navbar";
import { HallOfFameViewer } from "./hall-of-fame-viewer";
import { LeaguePage } from "./league-page";
import PixelTransition, {
	barBlindsTransition,
	circleWipeTransition,
} from "./pixel/PixelTransition";
import { PixelBox } from "./pixel-box";
import { IntroSequence } from "./intro";
import type { PlayerInfo } from "./player-create";
import { Pokedex } from "./pokedex";
import { TrainerCard } from "./TrainerCard";
import { TeamManagement } from "./team-management";
import { TournamentBracketViewer } from "./tournament-bracket-viewer";

function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

import { PartySocket } from "partysocket";

const socket = new PartySocket({
	host: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787",
	party: "main",
	room: "pubmon",
});

interface GameShellProps {
	initialPlayerState?: any;
	initialGymId?: number;
	initialGamePhase?: "collection" | "tournament" | "hall-of-fame";
}

export function GameShell({
	initialPlayerState,
	initialGymId,
	initialGamePhase,
}: GameShellProps) {
	const [sessionId, setSessionId] = useState<string>("");
	const [showBattleTransition, setShowBattleTransition] = useState(false);
	const { playBGM, stopBGM } = useAudio();

	// Initialize XState machine
	const [state, send] = useMachine(pubmonMachine, {
		input: {
			socket,
			initialPlayerState,
			initialGymId,
			initialGamePhase,
		},
	});

	const { context } = state;

	// Derived values from context
	const drinksCollected = context.battleLog.length;
	const seenIds = new Set(context.battleLog.map((entry) => entry.pokemon.id));
	const caughtIds = new Set(
		context.battleLog
			.filter((entry) => entry.outcome === "caught")
			.map((entry) => entry.pokemon.id),
	);
	const activePokemon =
		context.party.length > 0 ? context.party[context.activeIndex] : null;

	console.log("Current state:", state.value);
	console.log("Context:", context);

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
			// Update machine context with session ID
			(state.context as any).sessionId = stored;
		} else {
			const newId = generateUUID();
			setCookie("pubmon_session_id", newId);
			setSessionId(newId);
			// Update machine context with session ID
			(state.context as any).sessionId = newId;
		}
	}, []);

	// Play music based on machine state
	useEffect(() => {
		const inBattle =
			state.matches({ view: { mainLoop: "standardBattle" } }) ||
			state.matches({ view: { mainLoop: { tournament: "tournamentBattle" } } });
		const inCrawl = state.matches({ view: { mainLoop: "crawl" } });
		const inTeam = state.matches({ view: { mainLoop: "team" } });
		const inPokedex = state.matches({ view: { mainLoop: "pokedex" } });

		if (showBattleTransition || inBattle) {
			playBGM("battle");
		} else if (inCrawl || inPokedex || inTeam) {
			playBGM("route-1");
		} else {
			stopBGM();
		}
	}, [showBattleTransition, state.value, playBGM, stopBGM]);

	// Handler callbacks that send events to the machine
	const handlePlayerCreate = useCallback(
		(info: PlayerInfo, existingState?: any) => {
			console.log("PLAYER CREATED");
			send({ type: "PLAYER_CREATED", playerInfo: info, existingState });
		},
		[send],
	);

	const handleStarterSelect = useCallback(
		(pokemon: PubMon) => {
			send({ type: "SELECT_STARTER", pokemon });
		},
		[send],
	);

	const handleDrinkSelect = useCallback(
		(type: PubType) => {
			send({ type: "ORDER_DRINK", drinkType: type });
			setShowBattleTransition(true);
		},
		[send],
	);

	const handleBattleTransitionMidpoint = useCallback(() => {
		// Battle state is managed by the machine
		// No need to set phase here
	}, []);

	const handleBattleTransitionComplete = useCallback(() => {
		setShowBattleTransition(false);
	}, []);

	const handleCatch = useCallback(() => {
		send({ type: "CATCH" });
	}, [send]);

	const handleRun = useCallback(() => {
		send({ type: "RUN" });
	}, [send]);

	const handleBattleEnd = useCallback(
		(result: "win" | "loss") => {
			send({ type: "FAINT_DETECTED", result });
		},
		[send],
	);

	const handleSetActiveMon = useCallback(
		(idx: number) => {
			send({ type: "SET_ACTIVE_MON", index: idx });
		},
		[send],
	);

	// Global WebSocket listener - feeds events to the state machine
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			console.log("Received message:", msg.type, msg);

			// Map WebSocket messages to machine events
			if (msg.type === "gym_update" && msg.currentGymId != null) {
				send({
					type: "GYM_UPDATE",
					currentGymId: msg.currentGymId,
					gamePhase: msg.gamePhase,
				});
			}

			if (msg.type === "player_state" && msg.playerState) {
				send({ type: "PLAYER_STATE_UPDATE", playerState: msg.playerState });

				// Check if player has an active battle (reconnection scenario)
				if (
					msg.playerState.activeBattleId &&
					msg.playerState.activeBattleOpponent
				) {
					send({
						type: "MATCH_STARTED",
						battleId: msg.playerState.activeBattleId,
						opponentName: msg.playerState.activeBattleOpponent,
					});
				}
			}

			if (msg.type === "tournament_start") {
				send({ type: "TOURNAMENT_STARTED", bracket: msg.bracket });
			}

			if (msg.type === "bracket_update") {
				send({ type: "BRACKET_UPDATE", bracket: msg.bracket });
			}

			if (msg.type === "match_start") {
				send({
					type: "MATCH_STARTED",
					battleId: msg.battleId,
					opponentName: msg.opponentName,
				});
			}

			if (msg.type === "hall_of_fame_ready") {
				send({ type: "HALL_OF_FAME_READY" });
			}

			if (msg.type === "leaderboard_sync") {
				send({ type: "LEADERBOARD_SYNC", players: msg.players });
			}
		};

		socket.addEventListener("message", handleMessage);

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, [send]);

	// Helper functions to check machine state
	const stateValue = state.value as any;
	const isOnboarding =
		stateValue.view &&
		typeof stateValue.view === "object" &&
		"onboarding" in stateValue.view;
	const isStarter =
		stateValue.view?.onboarding === "starterSelect" ||
		stateValue.view?.onboarding === "selectingStarter";
	const isCrawl = stateValue.view?.mainLoop === "crawl";
	const isBattle = stateValue.view?.mainLoop === "standardBattle";
	const isTournamentBattle = state.matches({
		view: { mainLoop: { tournament: "tournamentBattle" } },
	});
	const isTournamentBracket = state.matches({
		view: { mainLoop: { tournament: "bracketView" } },
	});
	const isTeam =
		stateValue.view?.mainLoop === "team" ||
		stateValue.view?.mainLoop === "settingActiveMon";
	const isPokedex = stateValue.view?.mainLoop === "pokedex";
	const isLeague = stateValue.view?.mainLoop === "league";
	const isTournament =
		typeof stateValue.view?.mainLoop === "object" &&
		"tournament" in stateValue.view.mainLoop;
	const isHallOfFame = stateValue.view?.mainLoop === "hallOfFame";
	const isCaught = stateValue.view?.mainLoop?.celebration === "caught";
	const isXP = stateValue.view?.mainLoop?.celebration === "xpGain";
	const isBadgeReward =
		stateValue.view?.mainLoop?.celebration === "badgeReward";

	// Determine active tab for navbar
	const getActiveTab = ():
		| "crawl"
		| "pokedex"
		| "team"
		| "league"
		| undefined => {
		if (isCrawl) return "crawl";
		if (isPokedex) return "pokedex";
		if (isTeam) return "team";
		if (isLeague) return "league";
		return undefined;
	};

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
				{isOnboarding && sessionId && (
					<IntroSequence
						socket={socket}
						sessionId={sessionId}
						onPlayerCreate={handlePlayerCreate}
						onStarterSelect={handleStarterSelect}
					/>
				)}

				{isCrawl && (
					<DrinkSelect
						onSelect={handleDrinkSelect}
						onSelectGym={(gymId) =>
							send({ type: "GYM_UPDATE", currentGymId: gymId })
						}
						drinksCollected={drinksCollected}
						badges={context.badges}
						currentGymId={context.currentGymId}
						activePubmon={activePokemon}
						pokedexSeen={seenIds.size}
						pokedexTotal={ALL_PUBMON.length}
						playerName={context.playerInfo?.name}
						playerGender={context.playerInfo?.gender}
						gamePhase={context.gamePhase}
						activeBattleId={context.tournamentState.activeBattle?.battleId}
						activeBattleOpponent={
							context.tournamentState.activeBattle?.opponentName
						}
						onJoinBattle={() => send({ type: "NAVIGATE", phase: "tournament" })}
					/>
				)}

				{isBattle && context.activeEncounter.wildPubmon && (
					<BattleScreen
						wildPokemon={context.activeEncounter.wildPubmon}
						playerPokemon={activePokemon}
						onFight={() => {}}
						onCatch={handleCatch}
						onRun={handleRun}
						onBattleEnd={handleBattleEnd}
						battleMode="wild"
					/>
				)}

				{isTournamentBattle &&
					context.tournamentState.activeBattle &&
					activePokemon && (
						<BattleScreen
							wildPokemon={activePokemon} // Use player's own pokemon as "opponent" placeholder for now
							playerPokemon={activePokemon}
							onFight={() => {}}
							onCatch={() => {}} // No catch in tournament
							onRun={() => {}} // No run in tournament
							onBattleEnd={(result) => {
								// Handle tournament battle end
								send({
									type: "FAINT_DETECTED",
									result: result === "win" ? "win" : "loss",
								});
							}}
							battleMode="p2p"
							battleId={context.tournamentState.activeBattle.battleId}
							socket={socket}
							sessionId={sessionId}
						/>
					)}

				{isTeam && (
					<TeamManagement
						team={context.party}
						onBack={() => send({ type: "NAVIGATE", phase: "crawl" })}
						onSetActive={handleSetActiveMon}
						activeIndex={context.activeIndex}
					/>
				)}

				{isPokedex && (
					<Pokedex
						seenIds={seenIds}
						caughtIds={caughtIds}
						onBack={() => send({ type: "NAVIGATE", phase: "crawl" })}
					/>
				)}

				{isLeague && context.playerInfo && (
					<LeaguePage
						socket={socket}
						sessionId={sessionId}
						playerName={context.playerInfo.name}
						tournamentOptIn={context.tournamentState.isOptedIn}
						leaderboard={context.leaderboard}
						activeBattle={context.tournamentState.activeBattle}
						onReturnToBattle={() =>
							send({ type: "NAVIGATE", phase: "tournament" })
						}
						onBack={() => send({ type: "NAVIGATE", phase: "crawl" })}
					/>
				)}

				{isTournamentBracket && (
					<TournamentBracketViewer
						socket={socket}
						sessionId={sessionId}
						initialBracket={context.tournamentState.bracket || undefined}
					/>
				)}

				{isHallOfFame && (
					<HallOfFameViewer socket={socket} sessionId={sessionId} />
				)}

				{isCaught && context.caughtPokemon && (
					<div className="max-w-md mx-auto flex flex-col items-center gap-4 pt-8">
						<PixelBox variant="battle" className="w-full">
							<div className="flex flex-col items-center gap-4 py-4">
								<div
									className="w-24 h-24 border-2 flex items-center justify-center"
									style={{
										borderColor: `var(--type-${context.caughtPokemon.type})`,
										background: `var(--type-${context.caughtPokemon.type})22`,
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
								<p className="text-gba-[9] font-pixel font-palette-default text-center">GOTCHA!</p>
								<p className="text-gba-[9] font-sans font-palette-default text-center">
									{context.caughtPokemon.name} was caught!
								</p>
								<p className="text-gba-[9] font-sans font-palette-muted text-center leading-relaxed">
									{context.caughtPokemon.description}
								</p>
								<p className="text-gba-[9] font-sans font-palette-default">
									{context.caughtPokemon.name} was added to your team!
								</p>
							</div>
						</PixelBox>
						<button
							type="button"
							onClick={() => send({ type: "CONTINUE" })}
							className="border-4 border-foreground bg-primary text-primary-foreground px-6 py-3 text-gba-[9] font-sans font-palette-blue shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] hover:brightness-110 transition-all w-full max-w-xs"
						>
							CONTINUE CRAWL
						</button>
					</div>
				)}

				{isBadgeReward && context.awardedBadgeId && (
					<Badge3D
						badgeId={context.awardedBadgeId}
						onContinue={() => send({ type: "CONTINUE" })}
					/>
				)}

				{isXP && (
					<div className="max-w-md mx-auto flex flex-col items-center gap-4 pt-8">
						<PixelBox variant="battle" className="w-full">
							<div className="flex flex-col items-center gap-4 py-4">
								<p className="text-gba-[9] font-pixel font-palette-default text-center">VICTORY!</p>
								<p className="text-gba-[9] font-sans font-palette-default text-center">
									You defeated the wild{" "}
									{context.activeEncounter.wildPubmon?.name}!
								</p>
								<div className="border-2 border-primary/30 px-4 py-2">
									<p className="text-gba-[9] font-sans font-palette-default">
										+{context.xpGained} XP
									</p>
								</div>
								{activePokemon && (
									<p className="text-gba-[9] font-sans font-palette-muted text-center">
										{activePokemon.name} gained experience!
									</p>
								)}
							</div>
						</PixelBox>
						<button
							onClick={() => send({ type: "CONTINUE" })}
							type="button"
							className="border-4 border-foreground bg-primary text-primary-foreground px-6 py-3 text-gba-[9] font-sans font-palette-blue shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] hover:brightness-110 transition-all w-full max-w-xs"
						>
							CONTINUE CRAWL
						</button>
					</div>
				)}
			</main>

			{/* Bottom nav */}
			<GameNavbar
				isHidden={isStarter || isOnboarding || isBattle}
				activeTab={getActiveTab() || "crawl"}
				onNavigate={(phase) => send({ type: "NAVIGATE", phase })}
			/>

			{/* Debug Panel - only shows in development */}
			<DebugPanel state={state} context={context} />
		</div>
	);
}
