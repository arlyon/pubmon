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

export type BattleMenu = "main" | "fight" | "message";

export interface MoveSlot {
	name: string;
	pp: number;
	maxpp: number;
	disabled: boolean;
}

export interface ActivePokemon {
	name: string;
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
	engine?: BattleEngine; // Optional: if not provided, creates LocalBattleEngine
}

export function useBattle({
	wildPokemon,
	playerPokemon,
	engine,
}: UseBattleProps) {
	const [menu, setMenu] = useState<BattleMenu>("main");
	const [message, setMessage] = useState<string | null>(null);
	const [enemyHp, setEnemyHp] = useState(0);
	const [playerHp, setPlayerHp] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);
	const [playerShake, setPlayerShake] = useState(false);
	const [enemyShake, setEnemyShake] = useState(false);
	const [playerAttacking, setPlayerAttacking] = useState(false);
	const [enemyAttacking, setEnemyAttacking] = useState(false);
	const [playerActivePokemon, setPlayerActivePokemon] =
		useState<ActivePokemon | null>(null);
	const [enemyActivePokemon, setEnemyActivePokemon] =
		useState<ActivePokemon | null>(null);
	const [battleEnded, setBattleEnded] = useState(false);
	const [battleResult, setBattleResult] = useState<"win" | "loss" | null>(null);

	// Track PP usage for player's moves
	const movePPUsage = useRef<Map<string, number>>(new Map());

	// Track HP from protocol messages
	const p1HpRef = useRef<{ hp: number; maxhp: number }>({ hp: 0, maxhp: 0 });
	const p2HpRef = useRef<{ hp: number; maxhp: number }>({ hp: 0, maxhp: 0 });

	// Audio hook
	const { playAttackSFX } = useAudio();

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
		setMessage(nextMsg.text);

		// Apply HP changes when message is displayed
		if (nextMsg.playerHp !== undefined) {
			setPlayerHp(nextMsg.playerHp);
		}
		if (nextMsg.enemyHp !== undefined) {
			setEnemyHp(nextMsg.enemyHp);
		}
		if (nextMsg.playerShake) {
			setPlayerShake(true);
			setTimeout(() => setPlayerShake(false), 400);
		}
		if (nextMsg.enemyShake) {
			setEnemyShake(true);
			setTimeout(() => setEnemyShake(false), 400);
		}
		if (nextMsg.playerAttacking) {
			setPlayerAttacking(true);
			setTimeout(() => setPlayerAttacking(false), 300);
		}
		if (nextMsg.enemyAttacking) {
			setEnemyAttacking(true);
			setTimeout(() => setEnemyAttacking(false), 300);
		}

		// Execute callback when message is displayed
		if (nextMsg.onDisplay) {
			nextMsg.onDisplay();
		}

		// Don't auto-advance - wait for user to click
	}, []);

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

				let requestObj: Protocol.Request | undefined;
				if (line.startsWith("|request|")) {
					const jsonStr = line.split("|").slice(2).join("|");
					try {
						requestObj = JSON.parse(jsonStr);
					} catch (e) {
						console.error("Failed to parse request:", e);
					}
				}

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

				// Track PP usage when player uses a move
				if (line.startsWith("|move|p1a")) {
					const parts = line.split("|");
					const moveName = parts[3];
					if (moveName) {
						const currentPP = movePPUsage.current.get(moveName) || 0;
						movePPUsage.current.set(moveName, currentPP + 1);
					}
				}

				// Parse HP from protocol messages
				if (line.startsWith("|switch|")) {
					// Format: |switch|p1a: Player|Species|20/20
					const parts = line.split("|");
					const playerPart = parts[2];
					const hpPart = parts[4];

					if (hpPart) {
						const parsed = parseHpFromProtocol(hpPart);
						if (parsed) {
							if (playerPart.startsWith("p1a")) {
								// Player HP is actual values
								p1HpRef.current = parsed;
								setPlayerHp(parsed.hp); // Initialize HP on switch
								console.log("Updated p1 HP from switch:", parsed);
							} else if (playerPart.startsWith("p2a")) {
								// Enemy HP is percentage - convert to actual using baseMaxhp
								if (parsed.maxhp === 100) {
									// This is a percentage, convert it
									const pokemon = battleRef.current?.p2.active[0];
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
								console.log("Updated p2 HP from switch:", p2HpRef.current);
							}
						}
					}
				}

				if (line.startsWith("|-damage|")) {
					// Format: |-damage|p1a: Player|15/20
					const parts = line.split("|");
					const playerPart = parts[2];
					const hpPart = parts[3];

					if (hpPart) {
						const parsed = parseHpFromProtocol(hpPart);
						if (parsed) {
							if (playerPart.startsWith("p1a")) {
								p1HpRef.current = parsed;
								console.log("Updated p1 HP from damage:", parsed);
							} else if (playerPart.startsWith("p2a")) {
								// Enemy HP is percentage - convert to actual using baseMaxhp
								if (parsed.maxhp === 100) {
									const pokemon = battleRef.current?.p2.active[0];
									const baseMaxhp = pokemon?.baseMaxhp || 100;
									p2HpRef.current = {
										hp: Math.round((parsed.hp / 100) * baseMaxhp),
										maxhp: baseMaxhp,
									};
								} else {
									p2HpRef.current = parsed;
								}
								console.log("Updated p2 HP from damage:", p2HpRef.current);
							}
						}
					}
				}

				if (line.startsWith("|-heal|")) {
					// Format: |-heal|p1a: Player|20/20
					const parts = line.split("|");
					const playerPart = parts[2];
					const hpPart = parts[3];

					if (hpPart) {
						const parsed = parseHpFromProtocol(hpPart);
						if (parsed) {
							if (playerPart.startsWith("p1a")) {
								p1HpRef.current = parsed;
								console.log("Updated p1 HP from heal:", parsed);
							} else if (playerPart.startsWith("p2a")) {
								if (parsed.maxhp === 100) {
									const pokemon = battleRef.current?.p2.active[0];
									const baseMaxhp = pokemon?.baseMaxhp || 100;
									p2HpRef.current = {
										hp: Math.round((parsed.hp / 100) * baseMaxhp),
										maxhp: baseMaxhp,
									};
								} else {
									p2HpRef.current = parsed;
								}
								console.log("Updated p2 HP from heal:", p2HpRef.current);
							}
						}
					}
				}

				// Extract full Pokemon state for both players
				if (battleRef.current.p1.active[0]) {
					const p1Pokemon = battleRef.current.p1.active[0];
					// Only extract if species is properly loaded
					if (p1Pokemon.baseSpeciesForme && p1HpRef.current.maxhp > 0) {
						const p1State = extractPokemonState(
							p1Pokemon,
							"p1",
							playerPokemon?.moves,
						);
						if (p1State) {
							console.log("Setting p1 state:", p1State);
							setPlayerActivePokemon(p1State);
						}
					}
				}

				if (battleRef.current.p2.active[0]) {
					const p2Pokemon = battleRef.current.p2.active[0];
					// Only extract if species is properly loaded
					if (p2Pokemon.baseSpeciesForme && p2HpRef.current.maxhp > 0) {
						const p2State = extractPokemonState(
							p2Pokemon,
							"p2",
							wildPokemon.moves,
						);
						if (p2State) {
							console.log("Setting p2 state:", p2State);
							setEnemyActivePokemon(p2State);
						}
					}
				}

				// First, check if this line should be translated to a themed status message
				const translatedMessage = translateStatusMessage(line);
				if (translatedMessage) {
					messageQueueRef.current.push({ text: translatedMessage });
				} else if (line.startsWith("|-damage|")) {
					const parts = line.split("|");
					const pkmn = parts[2].substring(4);
					const isPlayer = parts[2].startsWith("p1a");
					const isEnemy = parts[2].startsWith("p2a");

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
					const isPlayer = parts[2].startsWith("p1a");
					const isEnemy = parts[2].startsWith("p2a");

					messageQueueRef.current.push({
						text: `${pkmn} used ${move}!`,
						playerAttacking: isPlayer,
						enemyAttacking: isEnemy,
						onDisplay: () => {
							// Trigger attack sound effect when message is displayed
							const moveId = move.toLowerCase().replace(/[^a-z0-9]+/g, "");
							const baseMoveId = getBaseMoveForAudio(moveId);
							if (baseMoveId) {
								playAttackSFX(baseMoveId);
							} else {
								// Fallback to Tackle if no mapping found
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
					messageQueueRef.current.push({ text: `${pkmn} fainted!` });
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
			playerPokemon,
			wildPokemon,
			translateStatusMessage,
			playAttackSFX,
			parseHpFromProtocol,
		],
	);

	useEffect(() => {
		if (!playerPokemon) return;

		// Initialize Battle client
		battleRef.current = new Battle(gens);

		// Create or use provided engine
		const battleEngine = engine || new LocalBattleEngine();
		engineRef.current = battleEngine;

		// Set up engine chunk handler
		battleEngine.onChunk(handleEngineChunk);

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

		const p1Team = createTeam("Player", playerPokemon, true, true);
		const p2Team = createTeam("Wild PubMon", wildPokemon);

		// Start battle
		battleEngine.start(p1Team, p2Team);

		// Cleanup on unmount
		return () => {
			if (engineRef.current) {
				engineRef.current.destroy();
				engineRef.current = null;
			}
		};
	}, [playerPokemon, wildPokemon, engine, handleEngineChunk]);

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
			if (isAnimating) {
				console.log("Blocked by isAnimating");
				return;
			}

			setIsAnimating(true);

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
	};
}
