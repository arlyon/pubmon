"use client";

import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
import { SettingsPanel } from "./settings-panel";
import { AnimatePresence } from "framer-motion";
import { TeamManagement } from "./team-management";
import { PlayCanvas } from "./play-canvas";
import {
	PokeballMessage,
	type PokeballMessageKind,
} from "./pokeball-message";

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
	ballOutcome?: { status?: string; pubmon?: PubMon | null } | null;
}

export function GameShell({
	initialPlayerState,
	initialGymId,
	initialGamePhase,
	ballOutcome,
}: GameShellProps) {
	const [sessionId, setSessionId] = useState<string>("");
	const [showBattleTransition, setShowBattleTransition] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [playingPubmon, setPlayingPubmon] = useState<PubMon | null>(null);
	const [ballMessage, setBallMessage] = useState<PokeballMessageKind | null>(
		null,
	);
	const [uiScale, setUiScale] = useState<number>(() => {
		if (typeof window === "undefined") return 1;
		const stored = localStorage.getItem("pubmon_ui_scale");
		const parsed = stored ? Number(stored) : 1;
		return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 2 ? parsed : 1;
	});
	const { playBGM, stopBGM, isMuted, toggleMute } = useAudio();

	const handleScaleChange = useCallback((scale: number) => {
		setUiScale(scale);
		localStorage.setItem("pubmon_ui_scale", String(scale));
	}, []);

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
		const inLeague =
			state.matches({ view: { mainLoop: "league" } }) ||
			state.matches({ view: { mainLoop: { tournament: "bracketView" } } });
		const inVictory =
			state.matches({ view: { mainLoop: { celebration: "xpGain" } } }) ||
			state.matches({ view: { mainLoop: { celebration: "badgeReward" } } });

		if (showBattleTransition || inBattle) {
			playBGM("battle");
		} else if (inVictory) {
			playBGM("victory");
		} else if (inCrawl || inPokedex || inTeam || inLeague) {
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

	// Navigation deferred to the wipe's midpoint, so the view only swaps once the
	// screen is fully covered (then the wipe reveals the new scene).
	const pendingBattleActionRef = useRef<(() => void) | null>(null);

	const startBattleTransition = useCallback((action: () => void) => {
		pendingBattleActionRef.current = action;
		setShowBattleTransition(true);
	}, []);

	const handleDrinkSelect = useCallback(
		(type: PubType) => {
			startBattleTransition(() =>
				send({ type: "ORDER_DRINK", drinkType: type }),
			);
		},
		[send, startBattleTransition],
	);

	const handleBattleTransitionMidpoint = useCallback(() => {
		// Fully covered: now swap the view (run the deferred navigation).
		const action = pendingBattleActionRef.current;
		pendingBattleActionRef.current = null;
		action?.();
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

	// Consume a pokeball scan outcome handed over by /p/<id> (server-side
	// claim + redirect). Opens the sandbox on success or shows a themed
	// message on error, then clears the one-shot cookie.
	useEffect(() => {
		if (!ballOutcome) return;
		document.cookie =
			"pubmon_ball_outcome=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";

		switch (ballOutcome.status) {
			case "owner":
			case "paired_now":
				if (ballOutcome.pubmon) setPlayingPubmon(ballOutcome.pubmon);
				break;
			case "foreign":
				setBallMessage("foreign");
				break;
			case "no_mon":
			case "no_player":
				setBallMessage("empty");
				break;
			default:
				setBallMessage("error");
		}
		// Only run for the initial server-provided outcome.
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
				// PLAYER_STATE_UPDATE also syncs activeBattle from the persisted
				// activeBattleId, so reconnects restore the battle notification.
				send({ type: "PLAYER_STATE_UPDATE", playerState: msg.playerState });
			}

			if (msg.type === "tournament_start") {
				send({ type: "TOURNAMENT_STARTED", bracket: msg.bracket });
			}

			if (msg.type === "bracket_update") {
				send({ type: "BRACKET_UPDATE", bracket: msg.bracket });
			}

			if (msg.type === "match_start") {
				// The broadcast goes to everyone; only react if this client is one
				// of the two combatants, and resolve the opponent's name by side.
				const amP1 = msg.player1SessionId === sessionId;
				const amP2 = msg.player2SessionId === sessionId;
				if (amP1 || amP2) {
					send({
						type: "MATCH_STARTED",
						battleId: msg.battleId,
						opponentName: amP1 ? msg.player2Name : msg.player1Name,
					});
				}
			}

			if (msg.type === "match_complete") {
				send({ type: "MATCH_COMPLETED", battleId: msg.battleId });
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
	}, [send, sessionId]);

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

	// Robust, always-visible alert when the player has an active tournament
	// match and isn't already in the battle screen. Tracked globally in the
	// machine's sync region, so it survives navigation and reconnects.
	const activeBattle = context.tournamentState.activeBattle;
	const showBattleAlert =
		!!activeBattle &&
		!isTournamentBattle &&
		!showBattleTransition &&
		!isOnboarding &&
		!isStarter;

	return (
		<div
			className="flex flex-col relative h-screen bg-pixel-gray-light"
			style={{ "--pixel-scale": uiScale } as CSSProperties}
		>
			{/* Active tournament battle notification */}
			{showBattleAlert && activeBattle && (
				<button
					type="button"
					onClick={() =>
						startBattleTransition(() => send({ type: "JOIN_BATTLE" }))
					}
					className="fixed top-0 inset-x-0 z-[900] font-heading text-pixel-white flex items-center justify-between gap-gba-[8] px-gba-[10] py-gba-[6] border-b-[3px] border-pixel-black"
					style={{
						background: "#d03838",
						boxShadow:
							"inset 2px 2px 0 rgba(255,255,255,0.25), inset -2px -2px 0 rgba(0,0,0,0.3)",
					}}
				>
					<span className="flex items-center gap-gba-[6] text-gba-[8]">
						<span style={{ animation: "pixel-blink 1s step-end infinite" }}>
							●
						</span>
						MATCH READY · VS {activeBattle.opponentName}
					</span>
					<span className="text-gba-[8]">JOIN →</span>
				</button>
			)}

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
							playerName={context.playerInfo?.name}
							opponentName={
								context.tournamentState.activeBattle.opponentName
							}
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

				{!showSettings &&
					(isLeague || isTournamentBracket) &&
					context.playerInfo && (
						<LeaguePage
							socket={socket}
							sessionId={sessionId}
							playerName={context.playerInfo.name}
							tournamentOptIn={context.tournamentState.isOptedIn}
							leaderboard={context.leaderboard}
							activeBattle={context.tournamentState.activeBattle}
							gamePhase={context.gamePhase}
							bracket={context.tournamentState.bracket}
							onReturnToBattle={() =>
								startBattleTransition(() => send({ type: "JOIN_BATTLE" }))
							}
							onBack={() => send({ type: "NAVIGATE", phase: "crawl" })}
						/>
					)}

				{isHallOfFame && (
					<HallOfFameViewer socket={socket} sessionId={sessionId} />
				)}

				{showSettings && (
					<SettingsPanel
						isMuted={isMuted}
						onToggleMute={toggleMute}
						uiScale={uiScale}
						onScaleChange={handleScaleChange}
						sessionId={sessionId}
						party={context.party}
					/>
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
			<AnimatePresence>
				{playingPubmon && (
					<PlayCanvas
						key="play-canvas"
						pubmon={playingPubmon}
						onExit={handleExitPlay}
						overlay={true}
					/>
				)}
			</AnimatePresence>

			{/* Pokeball scan result message (foreign / empty / error) */}
			<AnimatePresence>
				{ballMessage && (
					<PokeballMessage
						key="pokeball-message"
						kind={ballMessage}
						onDismiss={() => setBallMessage(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
