import { useState, useCallback, useEffect, useRef } from "react";
import { type PubMon, getBaseMoveForAudio } from "@/lib/pokemon-data";
import { Teams, Dex } from "@pkmn/sim";
import { Battle } from "@pkmn/client";
import { type ID } from "@pkmn/dex-types";
import { Generations } from "@pkmn/data";
import { type Protocol } from "@pkmn/protocol";
import { generatePubMonModData } from "@/lib/pokemon-data";
import { useAudio } from "@/components/audio-manager";
import { type BattleEngine, LocalBattleEngine } from "@/lib/battle-engine";

const customDex = Dex.mod("pubmon" as ID, generatePubMonModData() as any);
// Pass the custom dex to Generations so move lookups use our custom mod
const gens = new Generations(customDex);

/** The side ("p1"/"p2") a protocol ident like "p1a: Foo" or "p2" belongs to. */
function identSide(ident: string | undefined): "p1" | "p2" | null {
	if (!ident) return null;
	if (ident.startsWith("p1")) return "p1";
	if (ident.startsWith("p2")) return "p2";
	return null;
}

const otherSide = (side: "p1" | "p2"): "p1" | "p2" =>
	side === "p1" ? "p2" : "p1";

export type BattleMenu = "main" | "fight" | "message";

export interface MoveSlot {
	name: string;
	pp: number;
	maxpp: number;
	disabled: boolean;
}

export interface ActivePokemon {
	name: string;
	/** Species forme (e.g. "Mojitoad") used to resolve the correct sprite/type. */
	species: string;
	hp: number;
	maxhp: number;
	status: string | null;
	moves: MoveSlot[];
	boosts: {
		atk: number;
		def: number;
		spa: number;
		spd: number;
		spe: number;
	};
}

interface UseBattleProps {
	wildPokemon: PubMon;
	playerPokemon: PubMon | null;
	/**
	 * Optional factory for the battle engine. Called INSIDE the mount effect so
	 * a fresh engine is created on every (re)mount — this is what makes the P2P
	 * RemoteBattleEngine survive React StrictMode's mount/unmount/remount in dev
	 * (a memoized engine would be destroyed on the first cleanup and reused dead
	 * on the remount). If omitted, a LocalBattleEngine is used (wild battles).
	 */
	createEngine?: () => BattleEngine;
	onCatchSuccess?: () => void; // Called when catch succeeds in sim
	onRunSuccess?: () => void; // Called when run succeeds in sim
}

export function useBattle({
	wildPokemon,
	playerPokemon,
	createEngine,
	onCatchSuccess,
	onRunSuccess,
}: UseBattleProps) {
	const [menu, setMenu] = useState<BattleMenu>("main");
	const [message, setMessage] = useState<string | null>(null);
	const [enemyHp, setEnemyHp] = useState(0);
	const [playerHp, setPlayerHp] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);
	const [playerShake, setPlayerShake] = useState(false);
	const [playerFlash, setPlayerFlash] = useState(false);
	const [enemyFlash, setEnemyFlash] = useState(false);
	const [enemyShake, setEnemyShake] = useState(false);
	const [playerAttacking, setPlayerAttacking] = useState(false);
	const [enemyAttacking, setEnemyAttacking] = useState(false);
	const [playerActivePokemon, setPlayerActivePokemon] =
		useState<ActivePokemon | null>(null);
	const [enemyActivePokemon, setEnemyActivePokemon] =
		useState<ActivePokemon | null>(null);
	const [battleEnded, setBattleEnded] = useState(false);
	const [battleResult, setBattleResult] = useState<"win" | "loss" | null>(null);
	const lastMoveUsedRef = useRef<string | null>(null);
	const [battleLog, setBattleLog] = useState<{ dir: "in" | "out"; line: string; ts: number }[]>([]);

	// Track PP usage for player's moves
	const movePPUsage = useRef<Map<string, number>>(new Map());

	// Track HP from protocol messages. p1HpRef is always *this client's* mon,
	// p2HpRef the opponent's — regardless of which sim side (p1/p2) we are.
	const p1HpRef = useRef<{ hp: number; maxhp: number }>({ hp: 0, maxhp: 0 });
	const p2HpRef = useRef<{ hp: number; maxhp: number }>({ hp: 0, maxhp: 0 });

	// Which sim side this client controls. Wild battles are always p1; for PvP
	// the server tells us via battle_assign (and the request's side.id).
	const mySideRef = useRef<"p1" | "p2">("p1");

	// Latest pokemon, read via refs inside handleEngineChunk / the mount effect so
	// those callbacks stay stable and don't tear the engine down mid-battle when
	// a parent re-render hands us new object references.
	const playerPokemonRef = useRef(playerPokemon);
	const wildPokemonRef = useRef(wildPokemon);
	playerPokemonRef.current = playerPokemon;
	wildPokemonRef.current = wildPokemon;

	// Audio hook
	const { playAttackSFX, playSFX } = useAudio();

	const battleRef = useRef<Battle | null>(null);
	const engineRef = useRef<BattleEngine | null>(null);

	interface QueuedMessage {
		text: string;
		playerHp?: number;
		enemyHp?: number;
		playerShake?: boolean;
		enemyShake?: boolean;
		playerAttacking?: boolean;
		enemyAttacking?: boolean;
		onDisplay?: () => void;
		delay?: number; // ms to wait before showing this message
	}

	const messageQueueRef = useRef<QueuedMessage[]>([]);
	const processingRef = useRef(false);
	const lastRequestRef = useRef<Protocol.Request | null>(null);

	/**
	 * Parse HP from protocol messages like "|switch|p1a: Player|Species|20/20" or "15/100"
	 * Returns { hp, maxhp } or null if not parseable
	 */
	const parseHpFromProtocol = useCallback(
		(hpString: string): { hp: number; maxhp: number } | null => {
			const match = hpString.match(/(\d+)\/(\d+)/);
			if (!match) return null;

			const hp = parseInt(match[1]);
			const maxhp = parseInt(match[2]);

			// For percentages (maxhp = 100), we need to calculate actual HP based on baseMaxhp
			// But we'll handle this in the caller
			return { hp, maxhp };
		},
		[],
	);

	/**
	 * Translates standard status messages into PubMon-themed messages
	 */
	const translateStatusMessage = useCallback((line: string): string | null => {
		const parts = line.split("|");

		// Extract Pokemon name (remove player prefix like "p1a: " or "p2a: ")
		const getPokemonName = (fullName: string): string => {
			return fullName.substring(4); // Remove "p1a:" or "p2a:"
		};

		// Category A: "Hung Over" (par, slp, psn, tox)
		// |-status|[POKEMON]|[STATUS]
		if (line.startsWith("|-status|")) {
			const pokemon = getPokemonName(parts[2]);
			const status = parts[3];

			if (
				status === "par" ||
				status === "slp" ||
				status === "psn" ||
				status === "tox"
			) {
				return `${pokemon} is hung over!`;
			} else if (status === "brn" || status === "frz") {
				return `${pokemon} is completely hammered!`;
			}
		}

		// |cant|[POKEMON]|[REASON]
		if (line.startsWith("|cant|")) {
			const pokemon = getPokemonName(parts[2]);
			const reason = parts[3];

			if (reason === "par") {
				return `${pokemon} is too hung over to move!`;
			} else if (reason === "slp") {
				return `${pokemon} is sleeping off the hangover!`;
			} else if (reason === "frz") {
				return `${pokemon} is hammered and frozen to the bar!`;
			}
		}

		// |-damage|[POKEMON]|[HP]|[from] [SOURCE]
		if (line.startsWith("|-damage|") && parts.length >= 4) {
			const pokemon = getPokemonName(parts[2]);
			// Check if there's a [from] clause
			const fromClause = parts.find((p) => p.startsWith("[from]"));

			if (fromClause) {
				if (fromClause.includes("psn") || fromClause.includes("tox")) {
					return `${pokemon} is suffering from the hangover!`;
				} else if (fromClause.includes("brn")) {
					return `${pokemon} is hammered and burning up!`;
				} else if (fromClause.includes("confusion")) {
					return `${pokemon} is hammered and tripped over themselves!`;
				}
			}
		}

		// |-curestatus|[POKEMON]|[STATUS]
		if (line.startsWith("|-curestatus|")) {
			const pokemon = getPokemonName(parts[2]);
			const status = parts[3];

			if (
				status === "par" ||
				status === "slp" ||
				status === "psn" ||
				status === "tox"
			) {
				return `${pokemon} recovered from the hangover!`;
			} else if (status === "brn" || status === "frz") {
				return `${pokemon} sobered up!`;
			}
		}

		// |-start|[POKEMON]|confusion
		if (line.startsWith("|-start|") && line.includes("confusion")) {
			const pokemon = getPokemonName(parts[2]);
			return `${pokemon} is completely hammered!`;
		}

		// |-end|[POKEMON]|confusion
		if (line.startsWith("|-end|") && line.includes("confusion")) {
			const pokemon = getPokemonName(parts[2]);
			return `${pokemon} sobered up!`;
		}

		return null;
	}, []);

	const showMessage = useCallback((msg: QueuedMessage) => {
		setMessage(msg.text);

		if (msg.playerHp !== undefined) {
			setPlayerHp(msg.playerHp);
		}
		if (msg.enemyHp !== undefined) {
			setEnemyHp(msg.enemyHp);
		}
		if (msg.playerShake) {
			setPlayerShake(true);
			setPlayerFlash(true);
			playSFX("Scratch");
			setTimeout(() => setPlayerShake(false), 400);
			setTimeout(() => setPlayerFlash(false), 200);
		}
		if (msg.enemyShake) {
			setEnemyShake(true);
			setEnemyFlash(true);
			playSFX("Scratch");
			setTimeout(() => setEnemyShake(false), 400);
			setTimeout(() => setEnemyFlash(false), 200);
		}
		if (msg.playerAttacking) {
			setPlayerAttacking(true);
			setTimeout(() => setPlayerAttacking(false), 300);
		}
		if (msg.enemyAttacking) {
			setEnemyAttacking(true);
			setTimeout(() => setEnemyAttacking(false), 300);
		}
		if (msg.onDisplay) {
			msg.onDisplay();
		}
	}, [playSFX]);

	const processMessageQueue = useCallback(() => {
		if (processingRef.current) {
			return;
		}

		if (messageQueueRef.current.length === 0) {
			setIsAnimating(false);
			setMenu("main");
			setMessage(null);
			return;
		}

		processingRef.current = true;
		setIsAnimating(true);
		setMenu("message");

		const nextMsg = messageQueueRef.current.shift()!;

		if (nextMsg.delay) {
			setTimeout(() => showMessage(nextMsg), nextMsg.delay);
		} else {
			showMessage(nextMsg);
		}

		// Don't auto-advance - wait for user to click
	}, [showMessage]);

	const continueMessage = useCallback(() => {
		processingRef.current = false;
		processMessageQueue();
	}, [processMessageQueue]);

	const extractPokemonState = useCallback(
		(
			pokemon: any,
			playerIndex: "p1" | "p2",
			sourceMoves?: string[],
		): ActivePokemon | null => {
			if (!pokemon) return null;

			try {
				console.log(`Extracting ${playerIndex} state:`, {
					pokemon,
					"pokemon.moveSlots": pokemon.moveSlots,
					sourceMoves,
					movePPUsage: Array.from(movePPUsage.current.entries()),
				});

				// Use HP from refs (parsed from protocol messages)
				const hpRef = playerIndex === "p1" ? p1HpRef.current : p2HpRef.current;
				const hp = hpRef.hp;
				const maxhp = hpRef.maxhp;

				console.log(`${playerIndex} HP from protocol:`, {
					hp: hp,
					maxhp: maxhp,
				});

				// Extract status
				const status = pokemon.status || null;

				// Build moves from the source PubMon data with PP tracking
				const moves: MoveSlot[] = [];

				// First, try to get moves from pokemon.moveSlots (if available from sim)
				if (pokemon.moveSlots && pokemon.moveSlots.length > 0) {
					console.log(
						"Using moveSlots from pokemon object:",
						pokemon.moveSlots,
					);
					for (const slot of pokemon.moveSlots) {
						if (slot) {
							moves.push({
								name: slot.move || slot.id || "",
								pp: slot.pp || 0,
								maxpp: slot.maxpp || 20,
								disabled: slot.disabled || slot.pp <= 0,
							});
						}
					}
				} else if (sourceMoves && sourceMoves.length > 0) {
					// Fallback to source moves with manual PP tracking
					console.log("Using sourceMoves with manual tracking:", sourceMoves);
					for (const moveName of sourceMoves) {
						const ppUsed = movePPUsage.current.get(moveName) || 0;
						const maxpp = 15; // Changed from 20 to match the Dex definition
						const pp = Math.max(0, maxpp - ppUsed);

						moves.push({
							name: moveName,
							pp,
							maxpp,
							disabled: pp <= 0,
						});
					}
				}

				// Extract boosts
				const boosts = {
					atk: pokemon.boosts?.atk || 0,
					def: pokemon.boosts?.def || 0,
					spa: pokemon.boosts?.spa || 0,
					spd: pokemon.boosts?.spd || 0,
					spe: pokemon.boosts?.spe || 0,
				};

				return {
					name: pokemon.name || pokemon.species || "Unknown",
					species:
						pokemon.speciesForme ||
						pokemon.baseSpeciesForme ||
						pokemon.species ||
						pokemon.name ||
						"",
					hp: hp > 0 ? hp : 0,
					maxhp,
					status,
					moves,
					boosts,
				};
			} catch (error) {
				console.error("Error extracting Pokemon state:", error);
				return null;
			}
		},
		[],
	);

	const handleEngineChunk = useCallback(
		(chunk: string) => {
			if (!battleRef.current) return;

			console.debug("Engine chunk received:", chunk);

			for (const line of chunk.split("\n")) {
				if (!line) continue;
				console.debug("Processing line:", line);
				setBattleLog(prev => [...prev, { dir: "in", line, ts: Date.now() }]);

				let requestObj: Protocol.Request | undefined;
				if (line.startsWith("|request|")) {
					const jsonStr = line.split("|").slice(2).join("|");
					try {
						requestObj = JSON.parse(jsonStr);
						// The request's side.id confirms which side we control
						// (backs up the server's battle_assign).
						const sideId = (requestObj as any)?.side?.id;
						if (sideId === "p1" || sideId === "p2") {
							mySideRef.current = sideId;
						}
					} catch (e) {
						console.error("Failed to parse request:", e);
					}
				}

				// "mine" = this client's side, "foe" = the opponent's, whichever
				// sim side (p1/p2) we happen to be.
				const mySide = mySideRef.current;
				const foe = otherSide(mySide);

				try {
					battleRef.current.add(line);
				} catch (e) {
					// @pkmn/client doesn't fully support custom mods and will throw an error
					// when trying to clean up terastallization info on faint (searchid is undefined).
					// This is harmless since tera is a Gen 9 feature not relevant to Gen 1 mods.
					// We catch and ignore this specific error but rethrow others.
					if (e instanceof TypeError && e.message?.includes("searchid")) {
						console.debug(
							"Ignoring searchid error from @pkmn/client (custom species)",
						);
					} else {
						throw e;
					}
				}
				const req = requestObj || battleRef.current.request;
				if (req) {
					battleRef.current.update(req);
					lastRequestRef.current = req;
				}

				// Track PP usage when *we* use a move
				if (line.startsWith("|move|")) {
					const parts = line.split("|");
					if (identSide(parts[2]) === mySide) {
						const moveName = parts[3];
						if (moveName) {
							const currentPP = movePPUsage.current.get(moveName) || 0;
							movePPUsage.current.set(moveName, currentPP + 1);
						}
					}
				}

				// Parse HP from protocol messages
				if (line.startsWith("|switch|")) {
					// Format: |switch|p1a: Player|Species|20/20
					const parts = line.split("|");
					const playerPart = parts[2];
					const side = identSide(playerPart);
					const hpPart = parts[4];

					if (hpPart) {
						const parsed = parseHpFromProtocol(hpPart);
						if (parsed) {
							if (side === mySide) {
								// Our HP is actual values
								p1HpRef.current = parsed;
								setPlayerHp(parsed.hp); // Initialize HP on switch
								console.log("Updated my HP from switch:", parsed);
							} else if (side === foe) {
								// Foe HP may be a percentage - convert using baseMaxhp
								if (parsed.maxhp === 100) {
									const pokemon = battleRef.current?.[foe].active[0];
									const baseMaxhp = pokemon?.baseMaxhp || 100;
									p2HpRef.current = {
										hp: Math.round((parsed.hp / 100) * baseMaxhp),
										maxhp: baseMaxhp,
									};
								} else {
									// Already actual values
									p2HpRef.current = parsed;
								}
								setEnemyHp(p2HpRef.current.hp); // Initialize HP on switch
								console.log("Updated foe HP from switch:", p2HpRef.current);
							}
						}
					}
				}

				if (line.startsWith("|-damage|")) {
					// Format: |-damage|p1a: Player|15/20
					const parts = line.split("|");
					const playerPart = parts[2];
					const side = identSide(playerPart);
					const hpPart = parts[3];

					if (hpPart) {
						const parsed = parseHpFromProtocol(hpPart);
						if (parsed) {
							if (side === mySide) {
								p1HpRef.current = parsed;
								console.log("Updated my HP from damage:", parsed);
							} else if (side === foe) {
								// Foe HP may be a percentage - convert using baseMaxhp
								if (parsed.maxhp === 100) {
									const pokemon = battleRef.current?.[foe].active[0];
									const baseMaxhp = pokemon?.baseMaxhp || 100;
									p2HpRef.current = {
										hp: Math.round((parsed.hp / 100) * baseMaxhp),
										maxhp: baseMaxhp,
									};
								} else {
									p2HpRef.current = parsed;
								}
								console.log("Updated foe HP from damage:", p2HpRef.current);
							}
						}
					}
				}

				if (line.startsWith("|-heal|")) {
					// Format: |-heal|p1a: Player|20/20
					const parts = line.split("|");
					const playerPart = parts[2];
					const side = identSide(playerPart);
					const hpPart = parts[3];

					if (hpPart) {
						const parsed = parseHpFromProtocol(hpPart);
						if (parsed) {
							if (side === mySide) {
								p1HpRef.current = parsed;
								console.log("Updated my HP from heal:", parsed);
							} else if (side === foe) {
								if (parsed.maxhp === 100) {
									const pokemon = battleRef.current?.[foe].active[0];
									const baseMaxhp = pokemon?.baseMaxhp || 100;
									p2HpRef.current = {
										hp: Math.round((parsed.hp / 100) * baseMaxhp),
										maxhp: baseMaxhp,
									};
								} else {
									p2HpRef.current = parsed;
								}
								console.log("Updated foe HP from heal:", p2HpRef.current);
							}
						}
					}
				}

				// Extract full Pokemon state for both players (from our view)
				if (battleRef.current[mySide].active[0]) {
					const myPokemon = battleRef.current[mySide].active[0];
					// Only extract if species is properly loaded
					if (myPokemon.baseSpeciesForme && p1HpRef.current.maxhp > 0) {
						const myState = extractPokemonState(
							myPokemon,
							"p1",
							playerPokemonRef.current?.moves,
						);
						if (myState) {
							console.log("Setting my state:", myState);
							setPlayerActivePokemon(myState);
						}
					}
				}

				if (battleRef.current[foe].active[0]) {
					const foePokemon = battleRef.current[foe].active[0];
					// Only extract if species is properly loaded
					if (foePokemon.baseSpeciesForme && p2HpRef.current.maxhp > 0) {
						const foeState = extractPokemonState(
							foePokemon,
							"p2",
							wildPokemonRef.current?.moves,
						);
						if (foeState) {
							console.log("Setting foe state:", foeState);
							setEnemyActivePokemon(foeState);
						}
					}
				}

				// --- Catch / Run handling (native, not via |win|/|tie|) ---

				// Catch success: shake3 means the pokeball held
				if (line.startsWith("|-activate|") && line.includes("shake3")) {
					messageQueueRef.current.push({
						text: "Gotcha! The PubMon was caught!",
						onDisplay: () => onCatchSuccess?.(),
					});
					continue;
				}
				// Catch failure: shake1 means it broke free
				if (line.startsWith("|-activate|") && line.includes("shake1")) {
					lastMoveUsedRef.current = null; // Reset so faint/win aren't suppressed
					messageQueueRef.current.push({
						text: "Oh no! The PubMon broke free!",
					});
					continue;
				}
				// Skip sim-generated messages (we show our own)
				if (line.startsWith("||message|") || line.startsWith("|message|")) {
					continue;
				}
				// Skip |win|, |tie|, |faint| when caused by catch/run (not a real battle end)
				if (
					(line.startsWith("|win|") || line.startsWith("|tie") || line.startsWith("|faint|")) &&
					(lastMoveUsedRef.current === "catch" || lastMoveUsedRef.current === "run")
				) {
					continue;
				}

				// --- Normal battle message handling ---

				const translatedMessage = translateStatusMessage(line);
				if (translatedMessage) {
					messageQueueRef.current.push({ text: translatedMessage });
				} else if (line.startsWith("|-damage|")) {
					const parts = line.split("|");
					const pkmn = parts[2].substring(4);
					const isPlayer = identSide(parts[2]) === mySide;
					const isEnemy = identSide(parts[2]) === foe;

					messageQueueRef.current.push({
						text: `${pkmn} took damage!`,
						playerHp: isPlayer ? p1HpRef.current.hp : undefined,
						enemyHp: isEnemy ? p2HpRef.current.hp : undefined,
						playerShake: isPlayer,
						enemyShake: isEnemy,
					});
				} else if (line.startsWith("|move|")) {
					const parts = line.split("|");
					const pkmn = parts[2].substring(4);
					const move = parts[3];
					const isPlayer = identSide(parts[2]) === mySide;
					const isEnemy = identSide(parts[2]) === foe;

					// Track the last move used by the player
					if (isPlayer) {
						const moveId = move.toLowerCase().replace(/[^a-z0-9]+/g, "");
						lastMoveUsedRef.current = moveId;
					}

					const moveId = move.toLowerCase().replace(/[^a-z0-9]+/g, "");

					// Catch/Run: handle natively, skip "used X!" message
					if (moveId === "catch") {
						// Message will come from shake1/shake3 handler above
						continue;
					}
					if (moveId === "run") {
						messageQueueRef.current.push({
							text: "Got away safely!",
							onDisplay: () => onRunSuccess?.(),
						});
						continue;
					}

					messageQueueRef.current.push({
						text: `${pkmn} used ${move}!`,
						playerAttacking: isPlayer,
						enemyAttacking: isEnemy,
						onDisplay: () => {
							const baseMoveId = getBaseMoveForAudio(moveId);
							if (baseMoveId) {
								playAttackSFX(baseMoveId);
							} else {
								console.warn(
									`No base move mapping found for '${move}', using Tackle`,
								);
								playAttackSFX("tackle");
							}
						},
					});
				} else if (line.startsWith("|-supereffective|")) {
					messageQueueRef.current.push({ text: "It's super effective!" });
				} else if (line.startsWith("|-resisted|")) {
					messageQueueRef.current.push({ text: "It's not very effective..." });
				} else if (line.startsWith("|faint|")) {
					const pkmn = line.split("|")[2].substring(4);
					messageQueueRef.current.push({ text: `${pkmn} fainted!`, delay: 600 });
				} else if (line.startsWith("|win|")) {
					const winner = line.split("|")[2];
					if (winner === "Player") {
						messageQueueRef.current.push({
							text: "VICTORY!",
							onDisplay: () => {
								setBattleEnded(true);
								setBattleResult("win");
							},
						});
					} else {
						messageQueueRef.current.push({
							text: "DEFEATED...",
							onDisplay: () => {
								setBattleEnded(true);
								setBattleResult("loss");
							},
						});
					}
				} else if (
					line.startsWith("|-boost|") ||
					line.startsWith("|-unboost|")
				) {
					const parts = line.split("|");
					const pkmn = parts[2].substring(4);
					const stat = parts[3];
					const amount = parts[4];
					const direction = line.startsWith("|-boost|") ? "rose" : "fell";
					messageQueueRef.current.push({
						text: `${pkmn}'s ${stat.toUpperCase()} ${direction}!`,
					});
				}
			}

			processMessageQueue();
		},
		[
			processMessageQueue,
			extractPokemonState,
			translateStatusMessage,
			playAttackSFX,
			parseHpFromProtocol,
		],
	);

	const hasPlayerPokemon = !!playerPokemon;
	useEffect(() => {
		if (!playerPokemonRef.current) return;

		// Initialize Battle client
		battleRef.current = new Battle(gens);

		// Create the engine HERE (not in a parent useMemo) so each (re)mount gets
		// a fresh one — required for the self-connecting RemoteBattleEngine to
		// survive React StrictMode. Falls back to a local engine for wild battles.
		const battleEngine: BattleEngine = createEngine
			? createEngine()
			: new LocalBattleEngine();
		engineRef.current = battleEngine;

		// Set up engine chunk handler
		battleEngine.onChunk(handleEngineChunk);

		// Learn which side we control (remote/PvP only; local stays p1). Arrives
		// before any chunk so HP/perspective is correct from the first event.
		battleEngine.onMySide?.((side) => {
			mySideRef.current = side;
		});

		// Authoritative end from the server (forfeit / admin resolve / void).
		// Threads through to the battle UI even if no |win| chunk arrives.
		battleEngine.onEnd?.(({ outcome, reason }) => {
			messageQueueRef.current.push({
				text:
					reason === "void"
						? "MATCH VOIDED"
						: outcome === "win"
							? "VICTORY!"
							: "DEFEATED...",
				onDisplay: () => {
					setBattleEnded(true);
					setBattleResult(outcome);
				},
			});
			processMessageQueue();
		});

		// Create teams
		const formatId = (name: string) =>
			name.toLowerCase().replace(/[^a-z0-9]+/g, "");

		const createTeam = (name: string, p: any, doRun?: boolean, doCatch?: boolean) =>
			Teams.pack([
				{
					name: name,
					species: formatId(p.name),
					item: "",
					ability: "",
					moves: [...p.moves, ...(doRun === true ? ["run"] : []), ...(doCatch === true ? ["catch"] : [])].map(formatId),
					nature: "",
					evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
					ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
					level: p.level,
					gender: "M",
				} as any,
			]);

		const p1Team = createTeam("Player", playerPokemonRef.current, true, true);
		const p2Team = createTeam("Wild PubMon", wildPokemonRef.current);

		// Start battle
		battleEngine.start(p1Team, p2Team);

		// Cleanup on unmount
		return () => {
			if (engineRef.current) {
				engineRef.current.destroy();
				engineRef.current = null;
			}
		};
		// Deps are intentionally limited to the engine factory + "player ready"
		// edge: playerPokemon/wildPokemon are read via refs so a parent re-render
		// (new object refs) never tears down and rejoins an in-flight battle.
	}, [createEngine, hasPlayerPokemon, handleEngineChunk]);

	const handleAttack = useCallback(
		(moveIdx: number) => {
			console.log("handleAttack called:", {
				moveIdx,
				"engineRef.current": engineRef.current,
				isAnimating,
			});

			if (!engineRef.current) {
				console.error("engineRef.current is null!");
				return;
			}

			setIsAnimating(true);
			setBattleLog(prev => [...prev, { dir: "out", line: `move ${moveIdx + 1}`, ts: Date.now() }]);

			// Submit move through engine
			engineRef.current.submitMove(moveIdx);
		},
		[isAnimating],
	);

	const forfeitTurn = useCallback(() => {
		if (!engineRef.current) {
			console.error("engineRef.current is null!");
			return;
		}

		setBattleLog(prev => [...prev, { dir: "out", line: "pass", ts: Date.now() }]);
		engineRef.current.forfeitTurn();
	}, []);

	return {
		menu,
		setMenu,
		message,
		setMessage,
		enemyHp,
		playerHp,
		isAnimating,
		setIsAnimating,
		playerShake,
		enemyShake,
		playerFlash,
		enemyFlash,
		playerAttacking,
		enemyAttacking,
		handleAttack,
		playerActivePokemon,
		enemyActivePokemon,
		battleEnded,
		battleResult,
		continueMessage,
		forfeitTurn,
		protocolRequest: lastRequestRef.current,
		battleLog,
	};
}
