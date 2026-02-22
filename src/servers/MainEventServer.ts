import { Server, type Connection } from "partyserver";
import type { PubMon, PubType } from "../../lib/pokemon-data";
import { getRandomPubMon, ALL_PUBMON } from "../../lib/pokemon-data";
import type {
  GameState,
  PlayerState,
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
    };

    // Get admin secret from environment
    this.adminSecret = env.ADMIN_SECRET || "admin";
  }

  /**
   * Called when the Durable Object is first created or wakes from hibernation
   */
  async onStart() {
    // Load state from storage
    const stored = await this.ctx.storage.get<SerializableGameState>("gameState");
    if (stored) {
      this.gameState = deserializeGameState(stored);
      console.log(`[MainEventServer] Loaded state: ${this.gameState.players.size} players`);
    } else {
      console.log("[MainEventServer] Starting fresh");
    }
  }

  /**
   * Handle new WebSocket connections
   */
  async onConnect(connection: Connection) {
    console.log(`[MainEventServer] Client connected: ${connection.id}`);
    console.log("STATE", {
      phase: this.gameState.phase,
      currentGymId: this.gameState.currentGymId,
      playerCount: this.gameState.players.size,
      players: JSON.stringify(Array.from(this.gameState.players.entries())),
    });

    // Send current gym state to new connection
    this.sendToConnection(connection, {
      type: "gym_update",
      currentGymId: this.gameState.currentGymId,
    });

    // Send current leaderboard to new connection
    const leaderboard = Array.from(this.gameState.players.values()).map((p) => ({
      name: p.info.name,
      drinksLogged: p.drinksLogged,
      badges: Array.from(p.badges),
      partyCount: p.party.length,
    }));

    this.sendToConnection(connection, {
      type: "leaderboard_sync",
      players: leaderboard,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async onMessage(connection: Connection, message: string | ArrayBuffer) {
    // Convert ArrayBuffer to string if needed
    const messageStr = typeof message === "string" ? message : new TextDecoder().decode(message);
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
        const publicMessages = ["create_player", "check_name", "claim_player", "check_session"];
        if (!publicMessages.includes(msg.type) && "sessionId" in msg && !this.gameState.players.has(msg.sessionId)) {
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
        case "admin_forfeit_match":
          await this.handleAdminForfeitMatch(msg);
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

    // GET /rpc/gym - Fetch global gym ID
    if (request.method === "GET" && pathname === "/parties/main/rpc/gym") {
      return Response.json({ currentGymId: this.gameState.currentGymId });
    }

    // GET /rpc/player/:sessionId - Fetch full player state
    if (request.method === "GET" && pathname.startsWith("/parties/main/rpc/player/")) {
      const sessionId = pathname.split("/").pop();
      if (!sessionId) {
        return new Response("Missing session ID", { status: 400 });
      }

      const player = this.gameState.players.get(sessionId);
      if (!player) {
        return new Response("Player not found", { status: 404 });
      }

      // Return full serialized player state
      return Response.json(serializePlayerState(player));
    }

    // POST /rpc/battle-complete - Battle result from BattleServer
    if (request.method === "POST" && pathname === "/rpc/battle-complete") {
      const body = await request.json<{ battleId: string; winnerId: string }>();
      await this.completeBattleMatch(body.battleId, body.winnerId);

      return Response.json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  /**
   * Check if a session has an existing player account
   */
  private async handleCheckSession(
    msg: Extract<ClientMessage, { type: "check_session" }>,
    connection: Connection
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
   * Check if a player name is available
   */
  private async handleCheckName(
    msg: Extract<ClientMessage, { type: "check_name" }>,
    connection: Connection
  ) {
    const normalizedName = msg.name.trim().toUpperCase();
    let nameExists = false;

    // Check if name exists (case-insensitive)
    for (const player of this.gameState.players.values()) {
      if (player.info.name.toUpperCase() === normalizedName) {
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
    connection: Connection
  ) {
    const normalizedName = msg.name.trim().toUpperCase();
    let oldSessionId: string | null = null;
    let playerState: PlayerState | null = null;

    // Find the player by name
    for (const [sessionId, player] of this.gameState.players.entries()) {
      if (player.info.name.toUpperCase() === normalizedName) {
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

    // Persist changes
    await this.persistState();

    // Send updated player state
    this.sendToConnection(connection, {
      type: "player_state",
      playerState: serializePlayerState(playerState),
    });

    console.log(`[MainEventServer] Player ${normalizedName} claimed by session ${msg.newSessionId}`);
  }

  private async handleCreatePlayer(
    msg: Extract<ClientMessage, { type: "create_player" }>,
    connection: Connection
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
    const normalizedName = msg.playerInfo.name.trim().toUpperCase();
    for (const player of this.gameState.players.values()) {
      if (player.info.name.toUpperCase() === normalizedName) {
        this.sendError(connection, "Name already taken. Please use a different name or claim your existing account.");
        return;
      }
    }

    // Create new player
    const newPlayer: PlayerState = {
      sessionId: msg.sessionId,
      info: msg.playerInfo,
      pokedex: {
        seen: new Set(),
        caught: new Set(),
      },
      party: [],
      activeIndex: 0,
      badges: new Set(),
      drinksLogged: 0,
      tournamentOptIn: false,
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
    connection: Connection
  ) {
    const player = this.gameState.players.get(msg.sessionId)!;

    // RNG roll for PubMon encounter
    const wildPubmon = getRandomPubMon(msg.drinkType);

    // Update player stats
    player.drinksLogged++;
    player.pokedex.seen.add(wildPubmon.id);
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
    connection: Connection
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
      player.pokedex.caught.add(pubmon.id);
      player.lastActivity = Date.now();

      await this.persistState();

      this.sendToConnection(connection, {
        type: "catch_result",
        success: true,
        pubmon: caughtMon,
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
    connection: Connection
  ) {
    const player = this.gameState.players.get(msg.sessionId)!;

    if (player.party.length === 0) {
      this.sendError(connection, "No PubMon in party");
      return;
    }

    // Calculate XP gain (10-30 XP)
    const xpGained = Math.floor(Math.random() * 20) + 10;

    // Award XP to active PubMon
    const activeMon = player.party[player.activeIndex];
    if (activeMon) {
      activeMon.xp += xpGained;
    }

    player.lastActivity = Date.now();
    await this.persistState();

    this.sendToConnection(connection, {
      type: "fight_result",
      xpGained,
      updatedParty: player.party,
    });
  }

  private async handleSelectStarter(
    msg: Extract<ClientMessage, { type: "select_starter" }>,
    connection: Connection
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
    player.pokedex.seen.add(starter.id);
    player.pokedex.caught.add(starter.id);
    player.drinksLogged = 1;
    player.lastActivity = Date.now();

    await this.persistState();

    this.sendToConnection(connection, {
      type: "starter_selected",
      starter: starterCopy,
    });

    await this.broadcastLeaderboard();
  }

  private async handleUpdateParty(
    msg: Extract<ClientMessage, { type: "update_party" }>,
    connection: Connection
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
    connection: Connection
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
    connection: Connection
  ) {
    const player = this.gameState.players.get(msg.sessionId)!;

    player.tournamentOptIn = msg.optIn;
    player.lastActivity = Date.now();

    await this.persistState();

    this.sendToConnection(connection, {
      type: "player_state",
      playerState: serializePlayerState(player),
    });
  }

  // ============================================================================
  // Admin Handlers
  // ============================================================================

  private async handleAdminSetGym(msg: Extract<ClientMessage, { type: "admin_set_gym" }>) {
    this.gameState.currentGymId = msg.gymId;
    await this.persistState();

    // Broadcast gym update to all clients
    this.broadcastMessage({
      type: "gym_update",
      currentGymId: msg.gymId,
    });
  }

  private async handleAdminStartTournament() {
    // Get all opted-in players with at least 1 PubMon
    const eligiblePlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.tournamentOptIn && p.party.length > 0
    );

    if (eligiblePlayers.length < 2) {
      console.log("[MainEventServer] Not enough players for tournament");
      return;
    }

    // Create bracket
    const bracket = this.createBracket(eligiblePlayers);
    this.gameState.phase = "tournament";
    this.gameState.tournamentBracket = bracket;

    await this.persistState();

    // Broadcast tournament start
    this.broadcastMessage({
      type: "tournament_start",
      bracket,
    });

    // Start first round matches
    await this.startRoundMatches();
  }

  private async handleAdminForfeitMatch(
    msg: Extract<ClientMessage, { type: "admin_forfeit_match" }>
  ) {
    if (!this.gameState.tournamentBracket) return;

    const match = this.gameState.tournamentBracket.matches.find(
      (m) => m.battleId === msg.battleId
    );

    if (!match) return;

    // Determine winner (opposite of forfeiter)
    const winnerId =
      match.player1SessionId === msg.forfeitSessionId
        ? match.player2SessionId
        : match.player1SessionId;

    await this.completeBattleMatch(msg.battleId, winnerId);
  }

  // ============================================================================
  // Tournament Logic
  // ============================================================================

  private createBracket(players: PlayerState[]): TournamentBracket {
    // Shuffle players
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    const matches: TournamentMatch[] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      matches.push({
        matchId: `match_${i / 2}`,
        player1SessionId: shuffled[i].sessionId,
        player2SessionId: shuffled[i + 1].sessionId,
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

        // Send match start to both players
        this.broadcastMessage({
          type: "match_start",
          battleId,
          opponentName: player1.info.name,
        });
      }
    }

    await this.persistState();
  }

  /**
   * Called by BattleServer when a battle completes
   */
  async completeBattleMatch(battleId: string, winnerId: string) {
    if (!this.gameState.tournamentBracket) return;

    const match = this.gameState.tournamentBracket.matches.find(
      (m) => m.battleId === battleId
    );

    if (!match) return;

    match.winnerId = winnerId;
    match.status = "completed";

    const winner = this.gameState.players.get(winnerId);
    if (!winner) return;

    await this.persistState();

    // Broadcast match completion
    this.broadcastMessage({
      type: "match_complete",
      battleId,
      winnerId,
      winnerName: winner.info.name,
    });

    // Check if round is complete
    const roundComplete = this.gameState.tournamentBracket.matches.every(
      (m) => m.status === "completed"
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
      // Tournament complete
      console.log(`[MainEventServer] Tournament winner: ${winners[0]}`);
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

  private async broadcastLeaderboard() {
    const leaderboard = Array.from(this.gameState.players.values()).map((p) => ({
      name: p.info.name,
      drinksLogged: p.drinksLogged,
      badges: Array.from(p.badges),
      partyCount: p.party.length,
    }));

    this.broadcastMessage({
      type: "leaderboard_sync",
      players: leaderboard,
    });
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
