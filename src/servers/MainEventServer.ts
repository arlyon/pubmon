import { Server, getServerByName, type Connection } from "partyserver";
import type { PubMon, PubType } from "../../lib/pokemon-data";
import { getRandomPubMon, ALL_PUBMON } from "../../lib/pokemon-data";
import type {
	GameState,
	PlayerState,
	PokeballPairing,
	TournamentBracket,
	TournamentMatch,
	SerializableGameState,
} from "../types/game-state";
import {
	serializeGameState,
	deserializeGameState,
	serializePlayerState,
} from "../types/game-state";
import type { ClientMessage, ServerMessage } from "../types/messages";
import { DurableObjectState } from "@cloudflare/workers-types";

/** CORS headers for the browser-facing pokeball RPC endpoints. */
const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

/**
 * MainEventServer - The Global Event Room
 *
 * Responsibilities:
 * - Session management (frictionless UUID-based auth)
 * - Player Pokedex and Party state storage
 * - Drink logging and RNG-based encounters
 * - Global gym broadcast
 * - Matchmaking and tournament bracket management
 * - Admin commands (gym control, tournament triggers, match overrides)
 */
export class MainEventServer extends Server {
	private gameState: GameState;
	private adminSecret: string;

	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);

		// Initialize with default state
		this.gameState = {
			phase: "collection",
			currentGymId: 1,
			players: new Map(),
			pokeballs: new Map(),
		};

		// Get admin secret from environment
		this.adminSecret = env.ADMIN_SECRET || "admin";
	}

	/**
	 * Called when the Durable Object is first created or wakes from hibernation
	 */
	async onStart() {
		// Load state from storage
		const stored =
			await this.ctx.storage.get<SerializableGameState>("gameState");
		if (stored) {
			this.gameState = deserializeGameState(stored);
			console.log(
				`[MainEventServer] Loaded state: ${this.gameState.players.size} players`,
			);
			// One-time migration: rewrite legacy display names to the canonical
			// normalized form so stored names match the comparison logic.
			if (this.migrateNormalizeNames()) {
				await this.persistState();
			}
		} else {
			console.log("[MainEventServer] Starting fresh");
		}
	}

	/**
	 * Rewrites every player's stored display name to its normalized form.
	 * Returns true if any name changed.
	 */
	private migrateNormalizeNames(): boolean {
		let changed = false;

		for (const player of this.gameState.players.values()) {
			const canonical = this.normalizeName(player.info.name);
			if (player.info.name !== canonical) {
				player.info.name = canonical;
				changed = true;
			}
		}

		if (changed) {
			console.log("[MainEventServer] Migrated player names to canonical form");
		}
		return changed;
	}

	/**
	 * Handle new WebSocket connections
	 */
	async onConnect(connection: Connection) {
		console.log(`[MainEventServer] Client connected: ${connection.id}`);

		// Send current gym state to new connection
		this.sendToConnection(connection, {
			type: "gym_update",
			currentGymId: this.gameState.currentGymId,
			gamePhase: this.gameState.phase,
		});

		// Send current leaderboard to new connection
		this.sendToConnection(connection, {
			type: "leaderboard_sync",
			players: this.buildLeaderboard(),
		});

		// Send tournament state if one exists
		if (this.gameState.tournamentBracket) {
			// Send tournament_start if we're in tournament phase (sets phase on client)
			// Otherwise send bracket_update (just updates bracket without changing phase)
			const messageType =
				this.gameState.phase === "tournament"
					? "tournament_start"
					: "bracket_update";
			this.sendToConnection(connection, {
				type: messageType,
				bracket: this.gameState.tournamentBracket,
			});
		}

		// Send hall of fame if in that phase
		if (this.gameState.phase === "hall-of-fame" && this.gameState.hallOfFame) {
			this.sendToConnection(connection, {
				type: "hall_of_fame_ready",
				hallOfFame: this.gameState.hallOfFame,
			});
		}
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	async onMessage(connection: Connection, message: string | ArrayBuffer) {
		// Convert ArrayBuffer to string if needed
		const messageStr =
			typeof message === "string" ? message : new TextDecoder().decode(message);
		try {
			const msg: ClientMessage = JSON.parse(messageStr);

			// Verify admin messages
			if (this.isAdminMessage(msg)) {
				if (!this.verifyAdmin(msg)) {
					this.sendError(connection, "Invalid admin credentials");
					return;
				}
			} else {
				// Verify session exists for non-admin, non-create, non-check-name, non-claim messages
				const publicMessages = [
					"create_player",
					"check_name",
					"claim_player",
					"check_session",
				];
				if (
					!publicMessages.includes(msg.type) &&
					"sessionId" in msg &&
					!this.gameState.players.has(msg.sessionId)
				) {
					this.sendError(connection, "Invalid session ID");
					return;
				}
			}

			console.log("new message", msg, {
				phase: this.gameState.phase,
				currentGymId: this.gameState.currentGymId,
				playerCount: this.gameState.players.size,
				playerIds: Array.from(this.gameState.players.keys()),
			});

			// Route message to appropriate handler
			switch (msg.type) {
				case "check_session":
					await this.handleCheckSession(msg, connection);
					break;
				case "check_name":
					await this.handleCheckName(msg, connection);
					break;
				case "claim_player":
					await this.handleClaimPlayer(msg, connection);
					break;
				case "create_player":
					await this.handleCreatePlayer(msg, connection);
					break;
				case "order_drink":
					await this.handleOrderDrink(msg, connection);
					break;
				case "catch_attempt":
					await this.handleCatchAttempt(msg, connection);
					break;
				case "fight":
					await this.handleFight(msg, connection);
					break;
				case "run":
					await this.handleRun(msg, connection);
					break;
				case "select_starter":
					await this.handleSelectStarter(msg, connection);
					break;
				case "update_party":
					await this.handleUpdateParty(msg, connection);
					break;
				case "set_active_mon":
					await this.handleSetActiveMon(msg, connection);
					break;
				case "opt_in_tournament":
					await this.handleOptInTournament(msg, connection);
					break;
				case "admin_set_gym":
					await this.handleAdminSetGym(msg);
					break;
				case "admin_start_tournament":
					await this.handleAdminStartTournament();
					break;
				case "admin_reset_tournament":
					await this.handleAdminResetTournament();
					break;
				case "admin_resolve_match":
					await this.handleAdminResolveMatch(msg);
					break;
				case "admin_forfeit_match":
					await this.handleAdminForfeitMatch(msg);
					break;
				case "admin_promote_player":
					await this.handleAdminPromotePlayer(msg);
					break;
				case "admin_kick_player":
					await this.handleAdminKickPlayer(msg);
					break;
				case "admin_readd_player":
					await this.handleAdminReaddPlayer(msg);
					break;
				case "admin_assign_ribbon":
					await this.handleAdminAssignRibbon(msg);
					break;
				case "admin_trigger_hall_of_fame":
					await this.handleAdminTriggerHallOfFame();
					break;
				case "admin_request_state":
					await this.handleAdminRequestState(msg, connection);
					break;
				default:
					this.sendError(connection, "Unknown message type");
			}
		} catch (error) {
			console.error("[MainEventServer] Error handling message:", error);
			this.sendError(connection, "Internal server error");
		}
	}

	/**
	 * Handle HTTP requests for inter-DO communication (RPC)
	 */
	async onRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		console.log(`[MainEventServer] HTTP ${request.method} ${pathname}`);

		// The pokeball endpoints below are called from the browser (cross-origin
		// in dev: Next on :3000 -> worker on :8787), so answer CORS preflight.
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		// GET /rpc/gym - Fetch global gym ID and phase
		if (request.method === "GET" && pathname.endsWith("/rpc/gym")) {
			return Response.json({
				currentGymId: this.gameState.currentGymId,
				gamePhase: this.gameState.phase,
			});
		}

		// GET /rpc/player/:sessionId - Fetch full player state
		if (
			request.method === "GET" &&
			pathname.includes("/rpc/player/")
		) {
			const sessionId = pathname.split("/").pop();
			if (!sessionId) {
				return new Response("Missing session ID", { status: 400 });
			}

			const player = this.gameState.players.get(sessionId);
			if (!player) {
				return new Response("Player not found", { status: 404 });
			}

			// Return the full serialized player state. The page uses this to
			// hydrate the XState machine on reload (needs info/badges/optIn),
			// and the BattleServer extracts the battle slice it needs.
			return Response.json(serializePlayerState(player));
		}

		// GET /rpc/match/:battleId - participants for a tournament match, so the
		// BattleServer can start the sim from both teams without waiting for both
		// sockets to connect.
		if (request.method === "GET" && pathname.includes("/rpc/match/")) {
			const battleId = pathname.split("/").pop();
			const match = this.gameState.tournamentBracket?.matches.find(
				(m) => m.battleId === battleId,
			);
			if (!match || !match.player2SessionId) {
				return new Response("Match not found", { status: 404 });
			}
			return Response.json({
				player1SessionId: match.player1SessionId,
				player2SessionId: match.player2SessionId,
			});
		}

		// POST /rpc/battle-complete - Battle result from BattleServer
		if (request.method === "POST" && pathname.endsWith("/rpc/battle-complete")) {
			const body = await request.json<{
				battleId: string;
				winnerId: string;
				duration?: number;
				moveCount?: number;
			}>();
			await this.completeBattleMatch(
				body.battleId,
				body.winnerId,
				body.duration,
				body.moveCount,
			);

			return Response.json({ success: true });
		}

		// GET /rpc/pokeballs/:sessionId - List balls owned by a session
		if (request.method === "GET" && pathname.includes("/rpc/pokeballs/")) {
			const sessionId = pathname.split("/").pop();
			if (!sessionId) {
				return new Response("Missing session ID", { status: 400 });
			}
			return this.jsonCors({
				pokeballs: this.getOwnedPokeballs(sessionId),
			});
		}

		// POST /rpc/pokeball/:id/:action - claim | assign | unlink
		if (request.method === "POST" && pathname.includes("/rpc/pokeball/")) {
			const parts = pathname.split("/");
			const idx = parts.indexOf("pokeball");
			const ballId = parts[idx + 1];
			const action = parts[idx + 2];

			if (!ballId || !action) {
				return new Response("Missing ball id or action", { status: 400 });
			}

			if (action === "claim") {
				const body = await request.json<{ sessionId?: string }>();
				return this.jsonCors(
					await this.resolvePokeballClaim(ballId, body.sessionId),
				);
			}

			if (action === "assign") {
				const body = await request.json<{
					sessionId?: string;
					partyIndex?: number;
				}>();
				return this.jsonCors(
					await this.assignPokeballMon(ballId, body.sessionId, body.partyIndex),
				);
			}

			if (action === "unlink") {
				const body = await request.json<{ sessionId?: string }>();
				return this.jsonCors(await this.unlinkPokeball(ballId, body.sessionId));
			}

			return new Response("Unknown pokeball action", { status: 400 });
		}

		return new Response("Not found", { status: 404 });
	}

	// ============================================================================
	// Pokeball pairing
	// ============================================================================

	/** JSON response with CORS headers for browser-facing pokeball calls. */
	private jsonCors(data: unknown): Response {
		return Response.json(data, { headers: CORS_HEADERS });
	}

	/** Public summary of a ball, safe to send to its owner. */
	private serializePokeball(ball: PokeballPairing) {
		return {
			id: ball.id,
			pubmon: ball.pubmon,
			pairedAt: ball.pairedAt,
		};
	}

	/** All balls currently locked to a given session. */
	private getOwnedPokeballs(sessionId: string) {
		const owned: ReturnType<typeof this.serializePokeball>[] = [];
		for (const ball of this.gameState.pokeballs.values()) {
			if (ball.ownerSessionId === sessionId) {
				owned.push(this.serializePokeball(ball));
			}
		}
		return owned;
	}

	/**
	 * Resolve a scan of /p/<ballId> for a given session and perform the
	 * one-time claim when the ball is blank. Returns a status the client uses
	 * to decide which screen to render.
	 */
	private async resolvePokeballClaim(ballId: string, sessionId?: string) {
		// No cookie/session at all -> player needs to start the game first.
		if (!sessionId) {
			return { status: "no_player" as const };
		}

		const player = this.gameState.players.get(sessionId);
		if (!player) {
			return { status: "no_player" as const };
		}

		const ball = this.gameState.pokeballs.get(ballId);
		const now = Date.now();

		// Already locked to someone.
		if (ball && ball.ownerSessionId) {
			if (ball.ownerSessionId === sessionId) {
				ball.lastAccessAt = now;
				await this.persistState();
				return {
					status: "owner" as const,
					ballId,
					pubmon: ball.pubmon,
				};
			}
			// Someone else's ball - privacy-preserving error, no owner details.
			return { status: "foreign" as const };
		}

		// Blank (never claimed, or unlinked/given away) -> claim now.
		if (player.party.length === 0) {
			return { status: "no_mon" as const };
		}

		const mon = player.party[player.activeIndex] ?? player.party[0];
		const pairing: PokeballPairing = {
			id: ballId,
			ownerSessionId: sessionId,
			pubmon: mon,
			pairedAt: now,
			lastAccessAt: now,
		};
		this.gameState.pokeballs.set(ballId, pairing);
		await this.persistState();

		return {
			status: "paired_now" as const,
			ballId,
			pubmon: mon,
		};
	}

	/** Owner re-binds the ball to a different mon from their party. */
	private async assignPokeballMon(
		ballId: string,
		sessionId?: string,
		partyIndex?: number,
	) {
		if (!sessionId || partyIndex == null) {
			return { success: false, reason: "missing_args" as const };
		}

		const ball = this.gameState.pokeballs.get(ballId);
		if (!ball || ball.ownerSessionId !== sessionId) {
			return { success: false, reason: "not_owner" as const };
		}

		const player = this.gameState.players.get(sessionId);
		const mon = player?.party[partyIndex];
		if (!mon) {
			return { success: false, reason: "invalid_mon" as const };
		}

		ball.pubmon = mon;
		ball.lastAccessAt = Date.now();
		await this.persistState();

		return {
			success: true as const,
			pokeballs: this.getOwnedPokeballs(sessionId),
		};
	}

	/** Owner blanks the ball so it can be re-claimed (lost / given away). */
	private async unlinkPokeball(ballId: string, sessionId?: string) {
		if (!sessionId) {
			return { success: false, reason: "missing_args" as const };
		}

		const ball = this.gameState.pokeballs.get(ballId);
		if (!ball || ball.ownerSessionId !== sessionId) {
			return { success: false, reason: "not_owner" as const };
		}

		ball.ownerSessionId = null;
		ball.pubmon = null;
		ball.pairedAt = null;
		ball.lastAccessAt = Date.now();
		await this.persistState();

		return {
			success: true as const,
			pokeballs: this.getOwnedPokeballs(sessionId),
		};
	}

	// ============================================================================
	// Message Handlers
	// ============================================================================

	/**
	 * Check if a session has an existing player account
	 */
	private async handleCheckSession(
		msg: Extract<ClientMessage, { type: "check_session" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId);

		if (player) {
			// Session exists, send serialized player state
			this.sendToConnection(connection, {
				type: "player_state",
				playerState: serializePlayerState(player),
			});
		} else {
			// No player for this session - client should show create flow
			// Send a special response indicating no player found
			this.sendToConnection(connection, {
				type: "name_status",
				available: true,
			});
		}
	}

	/**
	 * Canonical form of a player name. Trims, collapses internal whitespace,
	 * and uppercases so that comparison and the stored display name always
	 * agree (the game UI is uppercase GBA styling).
	 */
	private normalizeName(name: string): string {
		return name.trim().replace(/\s+/g, " ").toUpperCase();
	}

	/**
	 * Check if a player name is available
	 */
	private async handleCheckName(
		msg: Extract<ClientMessage, { type: "check_name" }>,
		connection: Connection,
	) {
		const normalizedName = this.normalizeName(msg.name);
		let nameExists = false;

		// Check if name exists (case-insensitive)
		for (const player of this.gameState.players.values()) {
			if (this.normalizeName(player.info.name) === normalizedName) {
				nameExists = true;
				break;
			}
		}

		this.sendToConnection(connection, {
			type: "name_status",
			available: !nameExists,
			name: normalizedName,
		});
	}

	/**
	 * Claim an existing player account with a new session ID
	 */
	private async handleClaimPlayer(
		msg: Extract<ClientMessage, { type: "claim_player" }>,
		connection: Connection,
	) {
		const normalizedName = this.normalizeName(msg.name);
		let oldSessionId: string | null = null;
		let playerState: PlayerState | null = null;

		// Find the player by name
		for (const [sessionId, player] of this.gameState.players.entries()) {
			if (this.normalizeName(player.info.name) === normalizedName) {
				oldSessionId = sessionId;
				playerState = player;
				break;
			}
		}

		if (!playerState || !oldSessionId) {
			this.sendError(connection, "Player not found");
			return;
		}

		// Transfer player to new sessionId
		this.gameState.players.delete(oldSessionId);
		playerState.sessionId = msg.newSessionId;
		playerState.lastActivity = Date.now();
		this.gameState.players.set(msg.newSessionId, playerState);

		// Re-point any Pokéballs this trainer owns to the new session id, so
		// ball ownership survives claiming the account on a different device.
		for (const ball of this.gameState.pokeballs.values()) {
			if (ball.ownerSessionId === oldSessionId) {
				ball.ownerSessionId = msg.newSessionId;
			}
		}

		// Persist changes
		await this.persistState();

		// Send updated player state
		this.sendToConnection(connection, {
			type: "player_state",
			playerState: serializePlayerState(playerState),
		});

		console.log(
			`[MainEventServer] Player ${normalizedName} claimed by session ${msg.newSessionId}`,
		);
	}

	private async handleCreatePlayer(
		msg: Extract<ClientMessage, { type: "create_player" }>,
		connection: Connection,
	) {
		// Check if player already exists by sessionId
		if (this.gameState.players.has(msg.sessionId)) {
			const player = this.gameState.players.get(msg.sessionId)!;
			this.sendToConnection(connection, {
				type: "player_state",
				playerState: serializePlayerState(player),
			});
			return;
		}

		// Check if name is already taken (case-insensitive)
		const normalizedName = this.normalizeName(msg.playerInfo.name);
		for (const player of this.gameState.players.values()) {
			if (this.normalizeName(player.info.name) === normalizedName) {
				this.sendError(
					connection,
					"Name already taken. Please use a different name or claim your existing account.",
				);
				return;
			}
		}

		// Create new player (store the canonical, normalized display name)
		const newPlayer: PlayerState = {
			sessionId: msg.sessionId,
			info: { ...msg.playerInfo, name: normalizedName },
			party: [],
			activeIndex: 0,
			badges: new Set(),
			battleLog: [],
			tournamentOptIn: false,
			ribbons: [],
			createdAt: Date.now(),
			lastActivity: Date.now(),
		};

		this.gameState.players.set(msg.sessionId, newPlayer);
		await this.persistState();

		this.sendToConnection(connection, {
			type: "player_created",
			sessionId: msg.sessionId,
			playerState: newPlayer,
		});

		await this.broadcastLeaderboard();
	}

	private async handleOrderDrink(
		msg: Extract<ClientMessage, { type: "order_drink" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		// RNG roll for PubMon encounter
		const wildPubmon = getRandomPubMon(msg.drinkType);

		// Update player stats
		player.lastActivity = Date.now();

		await this.persistState();

		// Send encounter to player
		this.sendToConnection(connection, {
			type: "encounter_result",
			wildPubmon,
		});
	}

	private async handleCatchAttempt(
		msg: Extract<ClientMessage, { type: "catch_attempt" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		// Check party size
		if (player.party.length >= 6) {
			this.sendToConnection(connection, {
				type: "catch_result",
				success: false,
				reason: "Party is full",
			});
			return;
		}

		// Get the PubMon being caught
		const pubmon = ALL_PUBMON.find((p) => p.id === msg.pubmonId);
		if (!pubmon) {
			this.sendError(connection, "Invalid PubMon ID");
			return;
		}

		// RNG catch success (80% base rate)
		const catchRate = 0.8;
		const success = Math.random() < catchRate;

		if (success) {
			// Add to party and Pokedex
			const caughtMon = { ...pubmon, hp: pubmon.maxHp };
			player.party.push(caughtMon);

			// Add to battle log
			player.battleLog.push({
				pokemon: pubmon,
				startTime: msg.battleStartTime,
				endTime: msg.battleEndTime,
				outcome: "caught",
			});

			player.lastActivity = Date.now();

			await this.persistState();

			this.sendToConnection(connection, {
				type: "catch_result",
				success: true,
				pubmon: caughtMon,
			});

			// Send updated player state with new battleLog entry
			this.sendToConnection(connection, {
				type: "player_state",
				playerState: serializePlayerState(player),
			});

			await this.broadcastLeaderboard();
		} else {
			this.sendToConnection(connection, {
				type: "catch_result",
				success: false,
				reason: "The PubMon broke free!",
			});
		}
	}

	private async handleFight(
		msg: Extract<ClientMessage, { type: "fight" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		if (player.party.length === 0) {
			this.sendError(connection, "No PubMon in party");
			return;
		}

		// Get the wild PubMon that was fought
		const wildPubmon = ALL_PUBMON.find((p) => p.id === msg.pubmonId);
		if (!wildPubmon) {
			this.sendError(connection, "Invalid PubMon ID");
			return;
		}

		// Calculate XP gain (10-30 XP)
		const xpGained = Math.floor(Math.random() * 20) + 10;

		// Award XP to active PubMon
		const activeMon = player.party[player.activeIndex];
		if (activeMon) {
			activeMon.xp += xpGained;
		}

		// Add to battle log
		player.battleLog.push({
			pokemon: wildPubmon,
			startTime: msg.battleStartTime,
			endTime: msg.battleEndTime,
			outcome: "win",
		});

		// Check if player should earn a badge
		let awardedBadgeId: number | undefined;
		if (!player.badges.has(this.gameState.currentGymId)) {
			player.badges.add(this.gameState.currentGymId);
			awardedBadgeId = this.gameState.currentGymId;
		}

		player.lastActivity = Date.now();
		await this.persistState();

		this.sendToConnection(connection, {
			type: "fight_result",
			xpGained,
			updatedParty: player.party,
			awardedBadgeId,
		});

		console.log(xpGained, awardedBadgeId, player.battleLog.length);

		// Send updated player state with new battleLog entry
		this.sendToConnection(connection, {
			type: "player_state",
			playerState: serializePlayerState(player),
		});

		// Broadcast updated leaderboard if badge was awarded
		if (awardedBadgeId) {
			await this.broadcastLeaderboard();
		}
	}

	private async handleRun(
		msg: Extract<ClientMessage, { type: "run" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		// Get the wild PubMon that was fled from
		const wildPubmon = ALL_PUBMON.find((p) => p.id === msg.pubmonId);
		if (!wildPubmon) {
			this.sendError(connection, "Invalid PubMon ID");
			return;
		}

		// Add to battle log
		player.battleLog.push({
			pokemon: wildPubmon,
			startTime: msg.battleStartTime,
			endTime: msg.battleEndTime,
			outcome: "run",
		});

		player.lastActivity = Date.now();
		await this.persistState();

		// Send updated player state with new battleLog entry
		this.sendToConnection(connection, {
			type: "player_state",
			playerState: serializePlayerState(player),
		});
	}

	private async handleSelectStarter(
		msg: Extract<ClientMessage, { type: "select_starter" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		const starter = ALL_PUBMON.find((p) => p.id === msg.pubmonId);
		if (!starter) {
			this.sendError(connection, "Invalid starter PubMon ID");
			return;
		}

		const starterCopy = { ...starter, hp: starter.maxHp };
		player.party = [starterCopy];
		player.activeIndex = 0;

		// Add starter to battle log
		const now = Date.now();
		player.battleLog.push({
			pokemon: starterCopy,
			startTime: now,
			endTime: now,
			outcome: "caught",
		});
		player.lastActivity = Date.now();

		await this.persistState();

		this.sendToConnection(connection, {
			type: "starter_selected",
			starter: starterCopy,
		});

		// Send updated player state with new battleLog entry
		this.sendToConnection(connection, {
			type: "player_state",
			playerState: serializePlayerState(player),
		});

		await this.broadcastLeaderboard();
	}

	private async handleUpdateParty(
		msg: Extract<ClientMessage, { type: "update_party" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		player.party = msg.party;
		player.lastActivity = Date.now();

		await this.persistState();

		this.sendToConnection(connection, {
			type: "player_state",
			playerState: serializePlayerState(player),
		});
	}

	private async handleSetActiveMon(
		msg: Extract<ClientMessage, { type: "set_active_mon" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		if (msg.activeIndex < 0 || msg.activeIndex >= player.party.length) {
			this.sendError(connection, "Invalid active index");
			return;
		}

		player.activeIndex = msg.activeIndex;
		player.lastActivity = Date.now();

		await this.persistState();

		this.sendToConnection(connection, {
			type: "player_state",
			playerState: serializePlayerState(player),
		});
	}

	private async handleOptInTournament(
		msg: Extract<ClientMessage, { type: "opt_in_tournament" }>,
		connection: Connection,
	) {
		const player = this.gameState.players.get(msg.sessionId)!;

		player.tournamentOptIn = msg.optIn;
		player.lastActivity = Date.now();

		await this.persistState();

		this.sendToConnection(connection, {
			type: "player_state",
			playerState: serializePlayerState(player),
		});

		// Notify everyone (incl. the admin console) so opt-in status updates live.
		await this.broadcastLeaderboard();
	}

	// ============================================================================
	// Admin Handlers
	// ============================================================================

	private async handleAdminSetGym(
		msg: Extract<ClientMessage, { type: "admin_set_gym" }>,
	) {
		this.gameState.currentGymId = msg.gymId;
		await this.persistState();

		// Broadcast gym update to all clients
		this.broadcastMessage({
			type: "gym_update",
			currentGymId: msg.gymId,
			gamePhase: this.gameState.phase,
		});
	}

	private async handleAdminStartTournament() {
		// Get all opted-in players with all 10 badges
		const eligiblePlayers = Array.from(this.gameState.players.values()).filter(
			(p) => p.tournamentOptIn && p.party.length > 0,
		);

		if (eligiblePlayers.length < 2) {
			console.log(
				"[MainEventServer] Not enough players for tournament: ",
				eligiblePlayers.length,
			);
			return;
		}

		// Create bracket
		const bracket = this.createBracket(eligiblePlayers);
		this.gameState.phase = "tournament";
		this.gameState.tournamentBracket = bracket;

		await this.persistState();

		// Push the phase change so every connected client enters tournament mode
		// live (without this they wouldn't know until a page reload).
		this.broadcastPhase();

		// Broadcast tournament start
		this.broadcastMessage({
			type: "tournament_start",
			bracket,
		});

		// Start first round matches
		await this.startRoundMatches();
	}

	/**
	 * Tear down the current tournament and return everyone to the collection
	 * phase. Opt-ins are preserved so the admin can immediately start again.
	 */
	private async handleAdminResetTournament() {
		for (const player of this.gameState.players.values()) {
			player.activeBattleId = undefined;
			player.activeBattleOpponent = undefined;
		}
		this.gameState.tournamentBracket = undefined;
		// Clear any previous hall-of-fame results so a fresh tournament doesn't
		// inherit stale champions (calculateHallOfFame merges into this object).
		// Player ribbons are intentionally left intact.
		this.gameState.hallOfFame = undefined;
		this.gameState.phase = "collection";

		await this.persistState();

		// Phase change back to collection signals clients to leave the tournament.
		this.broadcastPhase();
		await this.broadcastLeaderboard();

		console.log("[Admin] Tournament reset -> collection");
	}

	/**
	 * Authoritatively resolve a match: declare a winner (winnerId) or void it
	 * (winnerId === null, nobody advances). Releases both players, formally ends
	 * the live battle room, and advances the round when complete.
	 */
	private async handleAdminResolveMatch(
		msg: Extract<ClientMessage, { type: "admin_resolve_match" }>,
	) {
		if (!this.gameState.tournamentBracket) return;

		const match = this.gameState.tournamentBracket.matches.find(
			(m) => m.matchId === msg.matchId,
		);
		if (!match) {
			console.log(`[Admin] resolve: match ${msg.matchId} not found`);
			return;
		}

		const winnerId = msg.winnerId;
		if (
			winnerId &&
			winnerId !== match.player1SessionId &&
			winnerId !== match.player2SessionId
		) {
			console.log(`[Admin] resolve: ${winnerId} is not in match ${msg.matchId}`);
			return;
		}

		match.winnerId = winnerId ?? undefined;
		match.status = winnerId ? "completed" : "forfeited";
		match.adminOverride = true;

		// Release both players from any active battle.
		const participants = [match.player1SessionId, match.player2SessionId]
			.filter((id): id is string => !!id)
			.map((id) => this.gameState.players.get(id));
		for (const p of participants) {
			if (p) {
				p.activeBattleId = undefined;
				p.activeBattleOpponent = undefined;
			}
		}

		await this.persistState();

		// Formally end the live battle room so each user's battle screen closes.
		if (match.battleId) {
			await this.endBattleRoom(
				match.battleId,
				winnerId ?? null,
				winnerId ? "admin" : "void",
			);
		}

		// Update the bracket UI / clients.
		const winnerName = winnerId
			? this.gameState.players.get(winnerId)?.info.name ?? ""
			: "";
		if (match.battleId) {
			this.broadcastMessage({
				type: "match_complete",
				battleId: match.battleId,
				winnerId: winnerId ?? "",
				winnerName,
			});
		}
		this.broadcastMessage({
			type: "bracket_update",
			bracket: this.gameState.tournamentBracket,
		});

		console.log(
			`[Admin] Resolved match ${msg.matchId}: ${winnerId ? `winner ${winnerName}` : "VOID"}`,
		);

		const roundComplete = this.gameState.tournamentBracket.matches.every(
			(m) => m.status === "completed" || m.status === "forfeited",
		);
		if (roundComplete) {
			await this.advanceTournament();
		}
	}

	/**
	 * Tell a BattleServer room to finish and notify both connected players
	 * (broadcasts battle_end). Used when the admin resolves a live match.
	 */
	private async endBattleRoom(
		battleId: string,
		winnerId: string | null,
		reason: "admin" | "void",
	) {
		try {
			const stub = await getServerByName(this.env.BATTLE_SERVER, battleId);
			await stub.fetch(`https://do/parties/battle/${battleId}/rpc/end-battle`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ winnerId, reason }),
			});
		} catch (error) {
			console.error("[MainEventServer] Failed to end battle room:", error);
		}
	}

	private async handleAdminForfeitMatch(
		msg: Extract<ClientMessage, { type: "admin_forfeit_match" }>,
	) {
		if (!this.gameState.tournamentBracket) return;

		const match = this.gameState.tournamentBracket.matches.find(
			(m) => m.battleId === msg.battleId,
		);

		if (!match || !match.player2SessionId) return;

		// Determine winner (opposite of forfeiter)
		const winnerId =
			match.player1SessionId === msg.forfeitSessionId
				? match.player2SessionId
				: match.player1SessionId;

		await this.completeBattleMatch(msg.battleId, winnerId);
	}

	private async handleAdminPromotePlayer(
		msg: Extract<ClientMessage, { type: "admin_promote_player" }>,
	) {
		if (!this.gameState.tournamentBracket) return;

		const match = this.gameState.tournamentBracket.matches.find(
			(m) => m.matchId === msg.matchId,
		);

		if (!match) {
			console.log(`[Admin] Match ${msg.matchId} not found`);
			return;
		}

		// Force advance the specified player
		match.winnerId = msg.sessionId;
		match.status = "completed";
		match.adminOverride = true;

		await this.persistState();

		// Broadcast bracket update
		this.broadcastMessage({
			type: "bracket_update",
			bracket: this.gameState.tournamentBracket,
		});

		console.log(
			`[Admin] Promoted player ${msg.sessionId} in match ${msg.matchId}`,
		);

		// Check if round is complete
		const roundComplete = this.gameState.tournamentBracket.matches.every(
			(m) => m.status === "completed",
		);

		if (roundComplete) {
			await this.advanceTournament();
		}
	}

	private async handleAdminKickPlayer(
		msg: Extract<ClientMessage, { type: "admin_kick_player" }>,
	) {
		if (!this.gameState.tournamentBracket) return;

		const match = this.gameState.tournamentBracket.matches.find(
			(m) => m.matchId === msg.matchId,
		);

		if (!match) {
			console.log(`[Admin] Match ${msg.matchId} not found`);
			return;
		}

		// Determine opponent
		const opponentId =
			match.player1SessionId === msg.sessionId
				? match.player2SessionId
				: match.player1SessionId;

		if (!opponentId) {
			console.log(`[Admin] Cannot kick player from bye match`);
			return;
		}

		// Don't overturn an already-decided match.
		if (match.winnerId) {
			console.log(`[Admin] Match ${msg.matchId} already has a winner`);
			return;
		}

		// Advance opponent by walkover.
		match.winnerId = opponentId;
		match.status = "forfeited";
		match.adminOverride = true;

		// Release both players from any active battle room. The opponent may be
		// sitting in the BattleServer waiting on the no-show; match_complete is
		// the signal clients use to leave the battle.
		const kicked = this.gameState.players.get(msg.sessionId);
		const opponent = this.gameState.players.get(opponentId);
		if (kicked) {
			kicked.activeBattleId = undefined;
			kicked.activeBattleOpponent = undefined;
		}
		if (opponent) {
			opponent.activeBattleId = undefined;
			opponent.activeBattleOpponent = undefined;
		}

		await this.persistState();

		// Tell clients the match is over (opponent leaves the battle room) and
		// push the updated bracket.
		if (match.battleId) {
			this.broadcastMessage({
				type: "match_complete",
				battleId: match.battleId,
				winnerId: opponentId,
				winnerName: opponent?.info.name ?? "",
			});
		}
		this.broadcastMessage({
			type: "bracket_update",
			bracket: this.gameState.tournamentBracket,
		});

		console.log(
			`[Admin] Kicked player ${msg.sessionId} from match ${msg.matchId}`,
		);

		// Check if round is complete
		const roundComplete = this.gameState.tournamentBracket.matches.every(
			(m) => m.status === "completed" || m.status === "forfeited",
		);

		if (roundComplete) {
			await this.advanceTournament();
		}
	}

	private async handleAdminReaddPlayer(
		msg: Extract<ClientMessage, { type: "admin_readd_player" }>,
	) {
		if (!this.gameState.tournamentBracket) return;

		const player = this.gameState.players.get(msg.sessionId);
		if (!player) {
			console.log(`[Admin] Player ${msg.sessionId} not found`);
			return;
		}

		// Add player to current round as a new match with bye
		const newMatch: TournamentMatch = {
			matchId: `match_readd_${Date.now()}`,
			player1SessionId: msg.sessionId,
			player2SessionId: null,
			winnerId: msg.sessionId,
			status: "completed",
			adminOverride: true,
		};

		this.gameState.tournamentBracket.matches.push(newMatch);

		await this.persistState();

		// Broadcast bracket update
		this.broadcastMessage({
			type: "bracket_update",
			bracket: this.gameState.tournamentBracket,
		});

		console.log(`[Admin] Re-added player ${msg.sessionId} to tournament`);
	}

	private async handleAdminAssignRibbon(
		msg: Extract<ClientMessage, { type: "admin_assign_ribbon" }>,
	) {
		const player = this.gameState.players.get(msg.sessionId);
		if (!player) {
			console.log(`[Admin] Player ${msg.sessionId} not found`);
			return;
		}

		// Add ribbon if not already present
		if (!player.ribbons.includes(msg.ribbonPath)) {
			player.ribbons.push(msg.ribbonPath);
			await this.persistState();

			// Broadcast updated player state
			this.broadcastMessage({
				type: "player_state",
				playerState: serializePlayerState(player),
			});

			console.log(
				`[Admin] Assigned ribbon ${msg.ribbonPath} to player ${msg.sessionId}`,
			);
		}
	}

	private async handleAdminTriggerHallOfFame() {
		// Calculate auto-ribbons
		await this.calculateHallOfFame();

		// Transition to hall-of-fame phase
		this.gameState.phase = "hall-of-fame";
		await this.persistState();

		// Push the phase change so clients leave tournament mode live.
		this.broadcastPhase();

		// Broadcast hall of fame ready
		this.broadcastMessage({
			type: "hall_of_fame_ready",
			hallOfFame: this.gameState.hallOfFame || {},
		});

		console.log("[Admin] Hall of Fame triggered");
	}

	private async handleAdminRequestState(
		msg: Extract<ClientMessage, { type: "admin_request_state" }>,
		connection: Connection,
	) {
		// Serialize the game state for debugging
		const debugState = serializeGameState(this.gameState);

		this.sendToConnection(connection, {
			type: "admin_state",
			state: debugState,
		});

		console.log("[Admin] State snapshot sent");
	}

	private async calculateHallOfFame() {
		if (!this.gameState.hallOfFame) {
			this.gameState.hallOfFame = {};
		}

		// Find tournament champion
		if (this.gameState.tournamentBracket) {
			const finalMatch = this.gameState.tournamentBracket.matches.find(
				(m) => m.status === "completed" && m.winnerId,
			);

			if (finalMatch?.winnerId) {
				const champion = this.gameState.players.get(finalMatch.winnerId);
				if (
					champion &&
					!champion.ribbons.includes("/sprites/ribbons/champion-ribbon.png")
				) {
					champion.ribbons.push("/sprites/ribbons/champion-ribbon.png");
					console.log(`[HallOfFame] Champion: ${champion.info.name}`);
				}
			}
		}

		// Calculate stat-based ribbons
		let mostRuns = { sessionId: "", count: 0 };
		let mostWins = { sessionId: "", count: 0 };
		let mostCaught = { sessionId: "", count: 0 };

		for (const [sessionId, player] of this.gameState.players.entries()) {
			const runCount = player.battleLog.filter(
				(entry) => entry.outcome === "run",
			).length;
			const winCount = player.battleLog.filter(
				(entry) => entry.outcome === "win",
			).length;
			const caughtCount = player.battleLog.filter(
				(entry) => entry.outcome === "caught",
			).length;

			if (runCount > mostRuns.count) {
				mostRuns = { sessionId, count: runCount };
			}
			if (winCount > mostWins.count) {
				mostWins = { sessionId, count: winCount };
			}
			if (caughtCount > mostCaught.count) {
				mostCaught = { sessionId, count: caughtCount };
			}
		}

		// Assign effort ribbon (most runs)
		if (mostRuns.sessionId) {
			const player = this.gameState.players.get(mostRuns.sessionId);
			if (
				player &&
				!player.ribbons.includes("/sprites/ribbons/effort-ribbon.png")
			) {
				player.ribbons.push("/sprites/ribbons/effort-ribbon.png");
				console.log(
					`[HallOfFame] Effort (most runs): ${player.info.name} (${mostRuns.count})`,
				);
			}
		}

		// Assign expert battler ribbon (most wins)
		if (mostWins.sessionId) {
			const player = this.gameState.players.get(mostWins.sessionId);
			if (
				player &&
				!player.ribbons.includes("/sprites/ribbons/expert-battler-ribbon.png")
			) {
				player.ribbons.push("/sprites/ribbons/expert-battler-ribbon.png");
				console.log(
					`[HallOfFame] Expert Battler (most wins): ${player.info.name} (${mostWins.count})`,
				);
			}
		}

		// Assign legend ribbon (most caught)
		if (mostCaught.sessionId) {
			const player = this.gameState.players.get(mostCaught.sessionId);
			if (
				player &&
				!player.ribbons.includes("/sprites/ribbons/legend-ribbon.png")
			) {
				player.ribbons.push("/sprites/ribbons/legend-ribbon.png");
				console.log(
					`[HallOfFame] Legend (most caught): ${player.info.name} (${mostCaught.count})`,
				);
			}
		}

		await this.persistState();
	}

	// ============================================================================
	// Tournament Logic
	// ============================================================================

	private createBracket(players: PlayerState[]): TournamentBracket {
		// Sort players by drinksLogged (descending) to give top players byes
		const sorted = [...players].sort(
			(a, b) => b.battleLog.length - a.battleLog.length,
		);

		// Calculate next power of 2
		const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(sorted.length)));
		const byesNeeded = nextPowerOf2 - sorted.length;

		console.log(
			`[Tournament] ${sorted.length} players, ${byesNeeded} byes needed (target: ${nextPowerOf2})`,
		);

		const matches: TournamentMatch[] = [];
		let matchIndex = 0;

		// Give byes to top players
		for (let i = 0; i < byesNeeded; i++) {
			matches.push({
				matchId: `match_${matchIndex++}`,
				player1SessionId: sorted[i].sessionId,
				player2SessionId: null, // Bye match
				winnerId: sorted[i].sessionId, // Auto-advance
				status: "completed",
			});
		}

		// Create matches for remaining players
		const remainingPlayers = sorted.slice(byesNeeded);
		for (let i = 0; i < remainingPlayers.length - 1; i += 2) {
			matches.push({
				matchId: `match_${matchIndex++}`,
				player1SessionId: remainingPlayers[i].sessionId,
				player2SessionId: remainingPlayers[i + 1].sessionId,
				status: "pending",
			});
		}

		return {
			round: 1,
			matches,
		};
	}

	private async startRoundMatches() {
		if (!this.gameState.tournamentBracket) return;

		for (const match of this.gameState.tournamentBracket.matches) {
			if (match.status === "pending") {
				const battleId = `battle_${match.matchId}_${Date.now()}`;
				match.battleId = battleId;
				match.status = "in_progress";

				const player1 = this.gameState.players.get(match.player1SessionId);
				const player2 = this.gameState.players.get(match.player2SessionId);

				if (!player1 || !player2) continue;

				// Set active battle info on both players
				player1.activeBattleId = battleId;
				player1.activeBattleOpponent = player2.info.name;
				player2.activeBattleId = battleId;
				player2.activeBattleOpponent = player1.info.name;

				// Broadcast match start - clients will filter based on their sessionId
				this.broadcastMessage({
					type: "match_start",
					battleId,
					player1SessionId: match.player1SessionId,
					player1Name: player1.info.name,
					player2SessionId: match.player2SessionId,
					player2Name: player2.info.name,
				});
			}
		}

		await this.persistState();
	}

	/**
	 * Called by BattleServer when a battle completes
	 */
	async completeBattleMatch(
		battleId: string,
		winnerId: string,
		durationMs?: number,
		moveCount?: number,
	) {
		if (!this.gameState.tournamentBracket) return;

		const match = this.gameState.tournamentBracket.matches.find(
			(m) => m.battleId === battleId,
		);

		if (!match) return;

		// First write wins: ignore late/duplicate reports (e.g. an orphaned
		// battle room reporting after an admin already resolved the match).
		if (match.winnerId) {
			console.log(
				`[MainEventServer] Ignoring battle-complete for already-decided match ${match.matchId}`,
			);
			return;
		}

		match.winnerId = winnerId;
		match.status = "completed";

		// Clear active battle info from both players
		const player1 = this.gameState.players.get(match.player1SessionId);
		const player2 = this.gameState.players.get(match.player2SessionId);

		if (player1) {
			player1.activeBattleId = undefined;
			player1.activeBattleOpponent = undefined;
		}
		if (player2) {
			player2.activeBattleId = undefined;
			player2.activeBattleOpponent = undefined;
		}

		const winner = this.gameState.players.get(winnerId);
		if (!winner) return;

		await this.persistState();

		// Broadcast match completion
		this.broadcastMessage({
			type: "match_complete",
			battleId,
			winnerId,
			winnerName: winner.info.name,
			durationMs,
			moveCount,
		});

		// Check if round is complete (a forfeited match — e.g. an admin kick of
		// an unresponsive player — also counts as done).
		const roundComplete = this.gameState.tournamentBracket.matches.every(
			(m) => m.status === "completed" || m.status === "forfeited",
		);

		if (roundComplete) {
			await this.advanceTournament();
		}
	}

	private async advanceTournament() {
		if (!this.gameState.tournamentBracket) return;

		const winners = this.gameState.tournamentBracket.matches
			.map((m) => m.winnerId)
			.filter(Boolean) as string[];

		if (winners.length === 1) {
			// Tournament complete — record the champion and enter the
			// post-tournament state.
			const champion = this.gameState.players.get(winners[0]);
			this.gameState.tournamentBracket.champion = winners[0];
			this.gameState.tournamentBracket.championName = champion?.info.name;

			await this.persistState();

			console.log(
				`[MainEventServer] Tournament champion: ${champion?.info.name ?? winners[0]}`,
			);

			// Broadcast the final bracket so clients see the crowned champion.
			this.broadcastMessage({
				type: "bracket_update",
				bracket: this.gameState.tournamentBracket,
			});
			return;
		}

		// Create next round
		const nextRoundPlayers = winners
			.map((id) => this.gameState.players.get(id))
			.filter(Boolean) as PlayerState[];

		const nextBracket = this.createBracket(nextRoundPlayers);
		nextBracket.round = this.gameState.tournamentBracket.round + 1;
		this.gameState.tournamentBracket = nextBracket;

		await this.persistState();

		this.broadcastMessage({
			type: "tournament_start",
			bracket: nextBracket,
		});

		await this.startRoundMatches();
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Broadcast the current game phase (and gym) to every connected client so
	 * phase transitions (collection <-> tournament <-> hall-of-fame) are
	 * reflected live, without requiring a page reload.
	 */
	private broadcastPhase() {
		this.broadcastMessage({
			type: "gym_update",
			currentGymId: this.gameState.currentGymId,
			gamePhase: this.gameState.phase,
		});
	}

	private async broadcastLeaderboard() {
		this.broadcastMessage({
			type: "leaderboard_sync",
			players: this.buildLeaderboard(),
		});
	}

	/**
	 * Build the leaderboard payload. Includes sessionId + sprite so clients can
	 * map tournament bracket entries (keyed by sessionId) back to players.
	 */
	private buildLeaderboard() {
		return Array.from(this.gameState.players.entries()).map(
			([sessionId, p]) => ({
				sessionId,
				name: p.info.name,
				sprite: p.info.sprite,
				drinksLogged: p.battleLog.length,
				battlesWon: p.battleLog.filter((b) => b.outcome === "win").length,
				totalBattles: p.battleLog.length,
				badges: Array.from(p.badges),
				partyCount: p.party.length,
				level:
					p.party.length > 0 ? Math.max(...p.party.map((mon) => mon.level)) : 1,
				tournamentOptIn: p.tournamentOptIn,
			}),
		);
	}

	private async persistState() {
		const serializable = serializeGameState(this.gameState);
		await this.ctx.storage.put("gameState", serializable);
	}

	private broadcastMessage(message: ServerMessage) {
		this.broadcast(JSON.stringify(message));
	}

	private sendToConnection(connection: Connection, message: ServerMessage) {
		connection.send(JSON.stringify(message));
	}

	private sendError(connection: Connection, message: string) {
		this.sendToConnection(connection, {
			type: "error",
			message,
		});
	}

	private isAdminMessage(msg: ClientMessage): boolean {
		return msg.type.startsWith("admin_");
	}

	private verifyAdmin(msg: any): boolean {
		return msg.adminSecret === this.adminSecret;
	}
}
