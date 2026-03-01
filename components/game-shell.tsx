"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
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
import { LeaguePage } from "./league-page";
import { TournamentBracketViewer } from "./tournament-bracket-viewer";
import { HallOfFameViewer } from "./hall-of-fame-viewer";
import { pubmonMachine } from "@/machines/pubmon-machine";

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
}

export function GameShell({
	initialPlayerState,
	initialGymId,
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
	const activePokemon = context.party.length > 0 ? context.party[context.activeIndex] : null;

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
		const inBattle = state.matches({ view: { mainLoop: 'standardBattle' } }) ||
			state.matches({ view: { mainLoop: { tournament: 'tournamentBattle' } } });
		const inCrawl = state.matches({ view: { mainLoop: 'crawl' } });
		const inTeam = state.matches({ view: { mainLoop: 'team' } });
		const inPokedex = state.matches({ view: { mainLoop: 'pokedex' } });

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
			send({ type: 'PLAYER_CREATED', playerInfo: info, existingState });
		},
		[send],
	);

	const handleStarterSelect = useCallback(
		(pokemon: PubMon) => {
			send({ type: 'SELECT_STARTER', pokemon });
		},
		[send],
	);

	const handleDrinkSelect = useCallback(
		(type: PubType) => {
			send({ type: 'ORDER_DRINK', drinkType: type });
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
		send({ type: 'CATCH' });
	}, [send]);

	const handleRun = useCallback(() => {
		send({ type: 'RUN' });
	}, [send]);

	const handleBattleEnd = useCallback(
		(result: "win" | "loss") => {
			send({ type: 'FAINT_DETECTED', result });
		},
		[send],
	);

	const handleSetActiveMon = useCallback(
		(idx: number) => {
			send({ type: 'SET_ACTIVE_MON', index: idx });
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
				send({ type: 'GYM_UPDATE', currentGymId: msg.currentGymId });
			}

			if (msg.type === "player_state" && msg.playerState) {
				send({ type: 'PLAYER_STATE_UPDATE', playerState: msg.playerState });
			}

			if (msg.type === "tournament_start") {
				send({ type: 'TOURNAMENT_STARTED', bracket: msg.bracket });
			}

			if (msg.type === "bracket_update") {
				send({ type: 'BRACKET_UPDATE', bracket: msg.bracket });
			}

			if (msg.type === "hall_of_fame_ready") {
				send({ type: 'HALL_OF_FAME_READY' });
			}

			if (msg.type === "leaderboard_sync") {
				send({ type: 'LEADERBOARD_SYNC', players: msg.players });
			}
		};

		socket.addEventListener("message", handleMessage);

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, [send]);

	// Helper functions to check machine state
	const stateValue = state.value as any;
	const isOnboarding = stateValue.view && typeof stateValue.view === 'object' && 'onboarding' in stateValue.view;
	const isStarter = stateValue.view?.onboarding === 'starterSelect' || stateValue.view?.onboarding === 'selectingStarter';
	const isCrawl = stateValue.view?.mainLoop === 'crawl';
	const isBattle = stateValue.view?.mainLoop === 'standardBattle';
	const isTeam = stateValue.view?.mainLoop === 'team' || stateValue.view?.mainLoop === 'settingActiveMon';
	const isPokedex = stateValue.view?.mainLoop === 'pokedex';
	const isLeague = stateValue.view?.mainLoop === 'league';
	const isTournament = typeof stateValue.view?.mainLoop === 'object' && 'tournament' in stateValue.view.mainLoop;
	const isHallOfFame = stateValue.view?.mainLoop === 'hallOfFame';
	const isCaught = stateValue.view?.mainLoop?.celebration === 'caught';
	const isXP = stateValue.view?.mainLoop?.celebration === 'xpGain';
	const isBadgeReward = stateValue.view?.mainLoop?.celebration === 'badgeReward';

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
				{isOnboarding && sessionId && !isStarter && (
					<PlayerCreate
						onComplete={handlePlayerCreate}
						socket={socket}
						sessionId={sessionId}
					/>
				)}

				{isStarter && context.playerInfo && (
					<StarterSelect onSelect={handleStarterSelect} name={context.playerInfo.name} />
				)}

				{isCrawl && (
					<DrinkSelect
						onSelect={handleDrinkSelect}
						onSelectGym={(gymId) => send({ type: 'GYM_UPDATE', currentGymId: gymId })}
						drinksCollected={drinksCollected}
						badges={context.badges}
						currentGymId={context.currentGymId}
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
					/>
				)}

				{isTeam && (
					<TeamManagement
						team={context.party}
						onBack={() => send({ type: 'NAVIGATE', phase: 'crawl' })}
						onSetActive={handleSetActiveMon}
						activeIndex={context.activeIndex}
					/>
				)}

				{isPokedex && (
					<Pokedex
						seenIds={seenIds}
						caughtIds={caughtIds}
						onBack={() => send({ type: 'NAVIGATE', phase: 'crawl' })}
					/>
				)}

				{isLeague && context.playerInfo && (
					<LeaguePage
						socket={socket}
						sessionId={sessionId}
						playerName={context.playerInfo.name}
						tournamentOptIn={context.tournamentState.isOptedIn}
						leaderboard={context.leaderboard}
						onBack={() => send({ type: 'NAVIGATE', phase: 'crawl' })}
					/>
				)}

				{isTournament && (
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
								<p className="text-[14px] text-primary text-center">GOTCHA!</p>
								<p className="text-[10px] text-foreground text-center">
									{context.caughtPokemon.name} was caught!
								</p>
								<p className="text-[8px] text-muted-foreground text-center leading-relaxed">
									{context.caughtPokemon.description}
								</p>
								<p className="text-[9px] text-foreground">
									{context.caughtPokemon.name} was added to your team!
								</p>
							</div>
						</PixelBox>
						<button
							type="button"
							onClick={() => send({ type: 'CONTINUE' })}
							className="border-4 border-foreground bg-primary text-primary-foreground px-6 py-3 text-[10px] font-sans shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] hover:brightness-110 transition-all w-full max-w-xs"
						>
							CONTINUE CRAWL
						</button>
					</div>
				)}

				{isBadgeReward && context.awardedBadgeId && (
					<Badge3D
						badgeId={context.awardedBadgeId}
						onContinue={() => send({ type: 'CONTINUE' })}
					/>
				)}

				{isXP && (
					<div className="max-w-md mx-auto flex flex-col items-center gap-4 pt-8">
						<PixelBox variant="battle" className="w-full">
							<div className="flex flex-col items-center gap-4 py-4">
								<p className="text-[14px] text-primary text-center">VICTORY!</p>
								<p className="text-[10px] text-foreground text-center">
									You defeated the wild {context.activeEncounter.wildPubmon?.name}!
								</p>
								<div className="border-2 border-primary/30 px-4 py-2">
									<p className="text-[12px] text-primary">+{context.xpGained} XP</p>
								</div>
								{activePokemon && (
									<p className="text-[8px] text-muted-foreground text-center">
										{activePokemon.name} gained experience!
									</p>
								)}
							</div>
						</PixelBox>
						<button
							onClick={() => send({ type: 'CONTINUE' })}
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
				className={`border-t-4 border-pixel-black bg-pixel-white ${isStarter || isOnboarding || isBattle ? "hidden" : ""}`}
			>
				<div className="max-w-md mx-auto flex items-stretch">
					<button
						type="button"
						onClick={() => send({ type: 'NAVIGATE', phase: 'crawl' })}
						className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer font-pixel transition-colors
              ${isCrawl ? "bg-pixel-blue text-pixel-white" : "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"}
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
						onClick={() => send({ type: 'NAVIGATE', phase: 'pokedex' })}
						type="button"
						className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer font-pixel transition-colors
              ${isPokedex ? "bg-pixel-red text-pixel-white" : "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"}
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
						onClick={() => send({ type: 'NAVIGATE', phase: 'team' })}
						type="button"
						className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer font-pixel transition-colors
              ${isTeam ? "bg-pixel-blue text-pixel-white" : "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"}
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
					<div className="w-[2px] bg-pixel-gray/30" />
					<button
						onClick={() => send({ type: 'NAVIGATE', phase: 'league' })}
						type="button"
						className={`flex-1 flex flex-col items-center gap-[2px] py-[8px] cursor-pointer font-pixel transition-colors
              ${isLeague ? "bg-pixel-yellow text-pixel-black" : "text-pixel-gray hover:text-pixel-black hover:bg-pixel-gray-light"}
            `}
					>
						<svg
							viewBox="0 0 12 12"
							width={16}
							height={16}
							className="pixel-perfect"
						>
							<polygon
								points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9 3,11 3.5,7.5 1,5 4.5,4.5"
								fill="currentColor"
							/>
						</svg>
						<span className="text-[5px]">LEAGUE</span>
					</button>
				</div>
			</nav>
		</div>
	);
}
