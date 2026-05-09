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
import { PostBattle } from "./post-battle";
import { TeamManagement } from "./team-management";
import { PlayCanvas } from "./play-canvas";
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
	const [showSettings, setShowSettings] = useState(false);
	const [playingPubmon, setPlayingPubmon] = useState<PubMon | null>(null);
	const { playBGM, stopBGM, isMuted, toggleMute } = useAudio();

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

	const handleExitPlay = useCallback(() => {
		setPlayingPubmon(null);
	}, []);

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
	const isRan = stateValue.view?.mainLoop?.celebration === "ran";

	// Determine active tab for navbar
	const getActiveTab = ():
		| "crawl"
		| "pokedex"
		| "team"
		| "league"
		| "settings"
		| undefined => {
		if (showSettings) return "settings";
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

				{!showSettings && isCrawl && (
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

				{!showSettings && isTeam && (
					<TeamManagement
						team={context.party}
						onBack={() => send({ type: "NAVIGATE", phase: "crawl" })}
						onSetActive={handleSetActiveMon}
						activeIndex={context.activeIndex}
						onPlay={setPlayingPubmon}
					/>
				)}

				{!showSettings && isPokedex && (
					<Pokedex
						seenIds={seenIds}
						caughtIds={caughtIds}
						onBack={() => send({ type: "NAVIGATE", phase: "crawl" })}
					/>
				)}

				{!showSettings && isLeague && context.playerInfo && (
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

				{showSettings && (
					<div className="flex-1 flex flex-col items-center justify-center gap-gba-[16] p-gba-[16]">
						<h2 className="text-gba-[12] font-bold text-pixel-black uppercase tracking-widest">Options</h2>
						<button
							type="button"
							onClick={toggleMute}
							className={`flex items-center gap-gba-[8] px-gba-[16] py-gba-[8] border-4 border-pixel-black text-gba-[9] font-bold uppercase transition-colors cursor-pointer ${
								isMuted
									? "bg-pixel-red text-pixel-white"
									: "bg-pixel-white text-pixel-black hover:bg-pixel-gray-light"
							}`}
						>
							{isMuted ? (
								<svg viewBox="0 0 12 12" className="pixel-perfect size-gba-[12]">
									<title>Muted</title>
									<rect x={0} y={4} width={3} height={4} fill="currentColor" />
									<polygon points="3,4 7,1 7,11 3,8" fill="currentColor" />
									<rect x={9} y={2} width={1.5} height={1.5} fill="currentColor" />
									<rect x={10.5} y={3.5} width={1.5} height={1.5} fill="currentColor" />
									<rect x={9} y={5} width={1.5} height={1.5} fill="currentColor" />
									<rect x={10.5} y={6.5} width={1.5} height={1.5} fill="currentColor" />
									<rect x={9} y={8} width={1.5} height={1.5} fill="currentColor" />
								</svg>
							) : (
								<svg viewBox="0 0 12 12" className="pixel-perfect size-gba-[12]">
									<title>Sound on</title>
									<rect x={0} y={4} width={3} height={4} fill="currentColor" />
									<polygon points="3,4 7,1 7,11 3,8" fill="currentColor" />
									<rect x={8} y={3} width={1.5} height={6} fill="currentColor" />
									<rect x={10} y={1} width={1.5} height={10} fill="currentColor" />
								</svg>
							)}
							{isMuted ? "UNMUTE" : "MUTE"}
						</button>
					</div>
				)}

				{isCaught && context.caughtPokemon && (
					<PostBattle
						variant="caught"
						onContinue={() => send({ type: "CONTINUE" })}
						caughtPokemon={context.caughtPokemon}
					/>
				)}

				{isBadgeReward && context.awardedBadgeId && (
					<Badge3D
						badgeId={context.awardedBadgeId}
						onContinue={() => send({ type: "CONTINUE" })}
					/>
				)}

				{isXP && (
					<PostBattle
						variant="xpGain"
						onContinue={() => send({ type: "CONTINUE" })}
						xpGained={context.xpGained}
						activePokemon={activePokemon ?? null}
						defeatedPokemon={context.activeEncounter.wildPubmon}
					/>
				)}

				{isRan && context.ranFromPubmon && (
					<PostBattle
						variant="ran"
						onContinue={() => send({ type: "CONTINUE" })}
						ranFromPubmon={context.ranFromPubmon}
						ranBattleTurns={context.ranBattleTurns}
						playerPokemon={activePokemon ?? null}
					/>
				)}
			</main>

			{/* Bottom nav */}
			<GameNavbar
				isHidden={isStarter || isOnboarding || isBattle}
				activeTab={getActiveTab() || "crawl"}
				onNavigate={(phase) => {
					if (phase === "settings") {
						setShowSettings(true);
					} else {
						setShowSettings(false);
						send({ type: "NAVIGATE", phase });
					}
				}}
			/>

			{/* Debug Panel - only shows in development */}
			<DebugPanel state={state} context={context} />

			{/* Play mode overlay - persists across navigation */}
			{playingPubmon && (
				<PlayCanvas
					pubmon={playingPubmon}
					onExit={handleExitPlay}
					overlay={true}
				/>
			)}
		</div>
	);
}
