"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRandomPubMon, type PubMon, type PubType } from "@/lib/pokemon-data";
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
	| "xp";

import { PartySocket } from "partysocket";

const socket = new PartySocket({
	host: "http://localhost:8787",
	party: "main",
	room: "pubmon",
});

interface GameShellProps {
	initialPlayerState?: any;
	initialGymId?: number;
}

export function GameShell({ initialPlayerState, initialGymId }: GameShellProps) {
	console.log("GameShell initialPlayerState:", initialPlayerState);
	console.log("Initial currentGymId:", initialGymId);

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
	const [drinksCollected, setDrinksCollected] = useState(
		initialPlayerState?.drinksLogged || 0,
	);
	const [xpGained, setXpGained] = useState(0);
	const [caughtPokemon, setCaughtPokemon] = useState<PubMon | null>(null);
	const [seenIds, setSeenIds] = useState<Set<number>>(
		initialPlayerState ? new Set(initialPlayerState.pokedex.seen) : new Set(),
	);
	const [caughtIds, setCaughtIds] = useState<Set<number>>(
		initialPlayerState ? new Set(initialPlayerState.pokedex.caught) : new Set(),
	);
	const [showBattleTransition, setShowBattleTransition] = useState(false);
	const [currentGymId, setCurrentGymId] = useState(initialGymId || 1);
	const [badges, setBadges] = useState<Set<number>>(
		initialPlayerState ? new Set(initialPlayerState.badges) : new Set(),
	);
	const battleMusicRef = useRef<HTMLAudioElement | null>(null);

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
				setDrinksCollected(playerState.drinksLogged);
				setSeenIds(new Set(playerState.pokedex.seen));
				setCaughtIds(new Set(playerState.pokedex.caught));
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

	// Play battle music during transition and battle phase
	useEffect(() => {
		const shouldPlayMusic = showBattleTransition || phase === "battle";

		if (shouldPlayMusic && battleMusicRef.current) {
			battleMusicRef.current
				.play()
				.catch((e) => console.log("Audio play prevented:", e));
		} else if (!shouldPlayMusic && battleMusicRef.current) {
			battleMusicRef.current.pause();
			battleMusicRef.current.currentTime = 0;
		}
	}, [showBattleTransition, phase]);

	const handlePlayerCreate = useCallback(
		(info: PlayerInfo, existingState?: any) => {
			setPlayer(info);

			if (existingState) {
				// Restore full player state
				setTeam(existingState.party);
				setActiveIdx(existingState.activeIndex);
				setDrinksCollected(existingState.drinksLogged);
				setSeenIds(new Set(existingState.pokedex.seen));
				setCaughtIds(new Set(existingState.pokedex.caught));
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
			setDrinksCollected(1);
			setSeenIds((prev) => new Set(prev).add(pokemon.id));
			setCaughtIds((prev) => new Set(prev).add(pokemon.id));
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
					setDrinksCollected((prev) => prev + 1);
					setSeenIds((prev) => new Set(prev).add(msg.wildPubmon.id));
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
	}, []);

	const handleBattleTransitionComplete = useCallback(() => {
		setShowBattleTransition(false);
	}, []);

	const handleFight = useCallback(() => {
		if (!wildPokemon) return;

		// Send fight message to server
		socket.send(
			JSON.stringify({
				type: "fight",
				sessionId,
				pubmonId: wildPokemon.id,
			}),
		);

		// Listen for fight_result
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "fight_result") {
				setXpGained(msg.xpGained);
				setTeam(msg.updatedParty);
				setPhase("xp");
				socket.removeEventListener("message", handleMessage);
			}
		};

		socket.addEventListener("message", handleMessage);
	}, [wildPokemon, sessionId]);

	const handleCatch = useCallback(() => {
		if (!wildPokemon) return;

		// Send catch_attempt message to server
		socket.send(
			JSON.stringify({
				type: "catch_attempt",
				sessionId,
				pubmonId: wildPokemon.id,
			}),
		);

		// Listen for catch_result
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "catch_result") {
				if (msg.success && msg.pubmon) {
					setCaughtPokemon(msg.pubmon);
					setTeam((prev) => [...prev, msg.pubmon]);
					setCaughtIds((prev) => new Set(prev).add(msg.pubmon.id));
					setPhase("caught");
				} else {
					// Handle failed catch (could show error message)
					setPhase("crawl");
				}
				socket.removeEventListener("message", handleMessage);
			}
		};

		socket.addEventListener("message", handleMessage);
	}, [wildPokemon, sessionId]);

	const handleRun = useCallback(() => {
		setWildPokemon(null);
		setPhase("crawl");
	}, []);

	// Debug: Log when currentGymId changes
	useEffect(() => {
		console.log("currentGymId changed to:", currentGymId);
	}, [currentGymId]);

	// Listen for gym updates from server
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			console.log("Received message:", msg.type, msg);
			if (msg.type === "gym_update" && msg.currentGymId != null) {
				console.log("Setting gym from gym_update:", msg.currentGymId);
				setCurrentGymId(msg.currentGymId);
			}
		};

		socket.addEventListener("message", handleMessage);

		return () => {
			socket.removeEventListener("message", handleMessage);
		};
	}, []);

	const activePokemon = team.length > 0 ? team[activeIdx] : null;

	return (
		<div className="flex flex-col relative min-h-screen">
			{/* Battle music (hidden audio element) */}
			<audio ref={battleMusicRef} src="/battle.mp3" loop />

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

			{/* Top bar */}
			{/* <header className="border-b-4 border-foreground bg-card">
        <div className="max-w-md mx-auto flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 10 10" width={20} height={20} style={{ imageRendering: "pixelated" }}>
              <circle cx={5} cy={5} r={4.5} fill="#e43b44" />
              <rect x={0.5} y={4.5} width={9} height={1} fill="#1a1c2c" />
              <circle cx={5} cy={5} r={4.5} fill="none" stroke="#1a1c2c" strokeWidth={0.5} />
              <rect x={0.5} y={5} width={9} height={4.5} rx={4.5} fill="#f4f4f4" />
              <circle cx={5} cy={5} r={1.2} fill="#f4f4f4" stroke="#1a1c2c" strokeWidth={0.4} />
              <circle cx={5} cy={5} r={0.6} fill="#1a1c2c" />
            </svg>
            <h1 className="text-[12px] text-primary">PUBMON</h1>
          </div>
          {phase !== "starter" && phase !== "player-create" ? (
            <div className="flex items-center gap-3">
              {player && (
                <span className="text-[7px] text-muted-foreground border border-foreground/20 px-1.5 py-0.5">
                  {player.name}
                </span>
              )}
              <button
                onClick={() => setPhase("pokedex")}
                className="text-[8px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-sans border-2 border-foreground/30 px-2 py-1"
              >
                DEX
              </button>
              <button
                onClick={() => setPhase("team")}
                className="text-[8px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-sans border-2 border-foreground/30 px-2 py-1"
              >
                TEAM
              </button>
              <button
                onClick={() => setPhase("crawl")}
                className="text-[8px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-sans border-2 border-foreground/30 px-2 py-1"
              >
                CRAWL
              </button>
            </div>
          ) : null}
        </div>
      </header> */}

			{/* Main content */}
			<main className="flex-1 px-2">
				{phase === "player-create" && sessionId && (
					<PlayerCreate
						onComplete={handlePlayerCreate}
						socket={socket}
						sessionId={sessionId}
					/>
				)}

				{phase === "starter" && (
					<StarterSelect onSelect={handleStarterSelect} />
				)}

				{phase === "crawl" && (
					<DrinkSelect
						onSelect={handleDrinkSelect}
						drinksCollected={drinksCollected}
						badges={badges}
						currentGymId={currentGymId}
					/>
				)}

				{phase === "battle" && wildPokemon && (
					<BattleScreen
						wildPokemon={wildPokemon}
						playerPokemon={activePokemon}
						onFight={handleFight}
						onCatch={handleCatch}
						onRun={handleRun}
					/>
				)}

				{phase === "team" && (
					<TeamManagement
						team={team}
						onBack={() => setPhase("crawl")}
						onSetActive={(idx) => setActiveIdx(idx)}
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
							onClick={() => setPhase("crawl")}
							className="border-4 border-foreground bg-primary text-primary-foreground px-6 py-3 text-[10px] font-sans
                shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer
                active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]
                active:translate-x-[2px] active:translate-y-[2px]
                hover:brightness-110 transition-all w-full max-w-xs"
						>
							CONTINUE CRAWL
						</button>
					</div>
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
							className="border-4 border-foreground bg-primary text-primary-foreground px-6 py-3 text-[10px] font-sans
                shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer
                active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]
                active:translate-x-[2px] active:translate-y-[2px]
                hover:brightness-110 transition-all w-full max-w-xs"
						>
							CONTINUE CRAWL
						</button>
					</div>
				)}
			</main>

			{/* Bottom nav */}
			<nav
				className={`border-t-4 border-foreground bg-card ${phase === "starter" || phase === "player-create" ? "hidden" : ""}`}
			>
				<div className="max-w-md mx-auto flex items-stretch">
					<button
						onClick={() => setPhase("crawl")}
						className={`flex-1 flex flex-col items-center gap-1 py-3 cursor-pointer font-sans transition-colors
              ${phase === "crawl" ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"}
            `}
					>
						<svg
							viewBox="0 0 8 8"
							width={16}
							height={16}
							style={{ imageRendering: "pixelated" }}
						>
							<rect x={2} y={0} width={4} height={1} fill="currentColor" />
							<rect x={1} y={1} width={6} height={5} fill="currentColor" />
							<rect x={3} y={6} width={2} height={2} fill="currentColor" />
						</svg>
						<span className="text-[7px]">CRAWL</span>
					</button>
					<div className="w-[2px] bg-foreground/20" />
					<button
						onClick={() => setPhase("pokedex")}
						className={`flex-1 flex flex-col items-center gap-1 py-3 cursor-pointer font-sans transition-colors
              ${phase === "pokedex" ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"}
            `}
					>
						<svg
							viewBox="0 0 12 12"
							width={16}
							height={16}
							style={{ imageRendering: "pixelated" }}
						>
							<rect
								x={0}
								y={0}
								width={12}
								height={12}
								rx={1}
								fill="currentColor"
							/>
							<rect x={1} y={1} width={10} height={10} rx={1} fill="#1a1c2c" />
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
						<span className="text-[7px]">PUBDEX</span>
					</button>
					<div className="w-[2px] bg-foreground/20" />
					<button
						onClick={() => setPhase("team")}
						className={`flex-1 flex flex-col items-center gap-1 py-3 cursor-pointer font-sans transition-colors
              ${phase === "team" ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"}
            `}
					>
						<svg
							viewBox="0 0 10 10"
							width={16}
							height={16}
							style={{ imageRendering: "pixelated" }}
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
						<span className="text-[7px]">PUBMON</span>
					</button>
				</div>
			</nav>
		</div>
	);
}
