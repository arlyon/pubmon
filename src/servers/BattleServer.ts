import { Server, type Connection } from "partyserver";
import type { PubMon } from "../../lib/pokemon-data";
import type { BattleState, BattlePlayer } from "../types/game-state";
import type { BattleClientMessage, BattleServerMessage } from "../types/messages";
import { DurableObjectState } from "@cloudflare/workers-types";

/**
 * BattleServer - Isolated Battle Sub-Room
 *
 * Responsibilities:
 * - Handle 1v1 turn-based battles
 * - Strict turn validation
 * - Fetch player party state from MainEventServer
 * - Report battle results back to MainEventServer
 * - Auto-cleanup after battle completion
 */
export class BattleServer extends Server {
  private battleState: BattleState | null = null;
  private connectionMap: Map<string, Connection> = new Map();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async onStart() {
    console.log(`[BattleServer] Battle room ${this.name} started`);
  }

  async onConnect(connection: Connection) {
    console.log(`[BattleServer] Client connected: ${connection.id}`);
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer) {
    const messageStr = typeof message === "string" ? message : new TextDecoder().decode(message);
    try {
      const msg: BattleClientMessage = JSON.parse(messageStr);

      switch (msg.type) {
        case "battle_join":
          await this.handleBattleJoin(msg, connection);
          break;
        case "battle_attack":
          await this.handleBattleAttack(msg, connection);
          break;
        case "battle_switch":
          await this.handleBattleSwitch(msg, connection);
          break;
        case "battle_forfeit":
          await this.handleBattleForfeit(msg, connection);
          break;
        default:
          this.sendError(connection, "Unknown battle message type");
      }
    } catch (error) {
      console.error("[BattleServer] Error handling message:", error);
      this.sendError(connection, "Internal server error");
    }
  }

  async onClose(connection: Connection) {
    console.log(`[BattleServer] Client disconnected: ${connection.id}`);

    // Mark player as disconnected
    if (this.battleState) {
      if (this.battleState.player1.sessionId === connection.id) {
        this.battleState.player1.connected = false;
      } else if (this.battleState.player2.sessionId === connection.id) {
        this.battleState.player2.connected = false;
      }

      // Auto-forfeit if player disconnects
      const disconnectedPlayer = !this.battleState.player1.connected
        ? this.battleState.player1
        : !this.battleState.player2.connected
          ? this.battleState.player2
          : null;

      if (disconnectedPlayer && this.battleState.status === "active") {
        const winnerId =
          disconnectedPlayer === this.battleState.player1
            ? this.battleState.player2.sessionId
            : this.battleState.player1.sessionId;
        await this.endBattle(winnerId);
      }
    }
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  private async handleBattleJoin(
    msg: Extract<BattleClientMessage, { type: "battle_join" }>,
    connection: Connection
  ) {
    // Fetch player data from MainEventServer
    const playerData = await this.fetchPlayerData(msg.sessionId);
    if (!playerData) {
      this.sendError(connection, "Failed to fetch player data");
      return;
    }

    // Initialize battle state if needed
    if (!this.battleState) {
      this.battleState = {
        battleId: this.name,
        player1: {
          sessionId: msg.sessionId,
          name: playerData.name,
          party: playerData.party,
          activeIndex: playerData.activeIndex,
          connected: true,
        },
        player2: {
          sessionId: "",
          name: "",
          party: [],
          activeIndex: 0,
          connected: false,
        },
        currentTurn: "player1",
        turnCount: 0,
        status: "waiting",
      };

      this.connectionMap.set(msg.sessionId, connection);
      console.log(`[BattleServer] Player 1 joined: ${playerData.name}`);
    } else if (!this.battleState.player2.connected) {
      // Second player joins
      this.battleState.player2 = {
        sessionId: msg.sessionId,
        name: playerData.name,
        party: playerData.party,
        activeIndex: playerData.activeIndex,
        connected: true,
      };

      this.connectionMap.set(msg.sessionId, connection);
      this.battleState.status = "active";

      console.log(`[BattleServer] Player 2 joined: ${playerData.name}`);

      // Broadcast initial battle state to both players
      await this.broadcastBattleState();
    } else {
      this.sendError(connection, "Battle is full");
    }
  }

  private async handleBattleAttack(
    msg: Extract<BattleClientMessage, { type: "battle_attack" }>,
    connection: Connection
  ) {
    if (!this.battleState || this.battleState.status !== "active") {
      this.sendError(connection, "Battle not active");
      return;
    }

    // Verify it's the player's turn
    const isPlayer1 = this.battleState.player1.sessionId === msg.sessionId;
    const isPlayer2 = this.battleState.player2.sessionId === msg.sessionId;

    if (!isPlayer1 && !isPlayer2) {
      this.sendError(connection, "You are not in this battle");
      return;
    }

    const currentPlayer = isPlayer1 ? this.battleState.player1 : this.battleState.player2;
    const expectedTurn = isPlayer1 ? "player1" : "player2";

    if (this.battleState.currentTurn !== expectedTurn) {
      this.sendError(connection, "Not your turn");
      return;
    }

    // Get attacker and defender
    const attacker = currentPlayer;
    const defender = isPlayer1 ? this.battleState.player2 : this.battleState.player1;

    const attackerMon = attacker.party[attacker.activeIndex];
    const defenderMon = defender.party[defender.activeIndex];

    if (!attackerMon || !defenderMon) {
      this.sendError(connection, "Invalid active PubMon");
      return;
    }

    if (msg.moveIndex < 0 || msg.moveIndex >= attackerMon.moves.length) {
      this.sendError(connection, "Invalid move index");
      return;
    }

    // Calculate damage
    const move = attackerMon.moves[msg.moveIndex];
    const baseDamage = attackerMon.attack - defenderMon.defense / 2;
    const damage = Math.max(5, Math.floor(baseDamage + Math.random() * 10));

    // Apply damage
    defenderMon.hp = Math.max(0, defenderMon.hp - damage);

    // Broadcast turn result
    this.broadcastMessage({
      type: "battle_turn_result",
      attacker: attacker.name,
      defender: defender.name,
      move,
      damage,
      defenderHp: defenderMon.hp,
      defenderMaxHp: defenderMon.maxHp,
      fainted: defenderMon.hp === 0,
    });

    // Check if defender's PubMon fainted
    if (defenderMon.hp === 0) {
      // Check if defender has more PubMon
      const hasMoreMons = defender.party.some((mon) => mon.hp > 0);

      if (!hasMoreMons) {
        // Battle over
        await this.endBattle(attacker.sessionId);
        return;
      } else {
        // Auto-switch to next available PubMon
        const nextIndex = defender.party.findIndex((mon) => mon.hp > 0);
        if (nextIndex !== -1) {
          defender.activeIndex = nextIndex;
        }
      }
    }

    // Switch turn
    this.battleState.currentTurn = this.battleState.currentTurn === "player1" ? "player2" : "player1";
    this.battleState.turnCount++;

    await this.broadcastBattleState();
  }

  private async handleBattleSwitch(
    msg: Extract<BattleClientMessage, { type: "battle_switch" }>,
    connection: Connection
  ) {
    if (!this.battleState || this.battleState.status !== "active") {
      this.sendError(connection, "Battle not active");
      return;
    }

    const isPlayer1 = this.battleState.player1.sessionId === msg.sessionId;
    const currentPlayer = isPlayer1 ? this.battleState.player1 : this.battleState.player2;

    if (msg.newActiveIndex < 0 || msg.newActiveIndex >= currentPlayer.party.length) {
      this.sendError(connection, "Invalid switch index");
      return;
    }

    const newMon = currentPlayer.party[msg.newActiveIndex];
    if (newMon.hp === 0) {
      this.sendError(connection, "Cannot switch to fainted PubMon");
      return;
    }

    currentPlayer.activeIndex = msg.newActiveIndex;

    // Switching consumes your turn
    this.battleState.currentTurn = this.battleState.currentTurn === "player1" ? "player2" : "player1";
    this.battleState.turnCount++;

    await this.broadcastBattleState();
  }

  private async handleBattleForfeit(
    msg: Extract<BattleClientMessage, { type: "battle_forfeit" }>,
    connection: Connection
  ) {
    if (!this.battleState) {
      this.sendError(connection, "No active battle");
      return;
    }

    const isPlayer1 = this.battleState.player1.sessionId === msg.sessionId;
    const winnerId = isPlayer1
      ? this.battleState.player2.sessionId
      : this.battleState.player1.sessionId;

    await this.endBattle(winnerId);
  }

  // ============================================================================
  // Battle Utilities
  // ============================================================================

  private async endBattle(winnerId: string) {
    if (!this.battleState) return;

    this.battleState.status = "completed";
    this.battleState.winnerId = winnerId;

    const winner =
      this.battleState.player1.sessionId === winnerId
        ? this.battleState.player1
        : this.battleState.player2;

    // Broadcast battle end
    this.broadcastMessage({
      type: "battle_end",
      winnerId,
      winnerName: winner.name,
    });

    // Report result back to MainEventServer
    await this.reportBattleResult(winnerId);

    // Close connections after a delay
    setTimeout(() => {
      this.broadcast("BATTLE_COMPLETE");
      // Connections will auto-close
    }, 3000);
  }

  private async broadcastBattleState() {
    if (!this.battleState) return;

    const player1Mon = this.battleState.player1.party[this.battleState.player1.activeIndex];
    const player2Mon = this.battleState.player2.party[this.battleState.player2.activeIndex];

    if (!player1Mon || !player2Mon) return;

    this.broadcastMessage({
      type: "battle_state",
      battleId: this.battleState.battleId,
      player1: {
        name: this.battleState.player1.name,
        activePubmon: player1Mon,
        partyCount: this.battleState.player1.party.filter((m) => m.hp > 0).length,
      },
      player2: {
        name: this.battleState.player2.name,
        activePubmon: player2Mon,
        partyCount: this.battleState.player2.party.filter((m) => m.hp > 0).length,
      },
      currentTurn: this.battleState.currentTurn,
      turnCount: this.battleState.turnCount,
    });
  }

  // ============================================================================
  // Communication with MainEventServer
  // ============================================================================

  private async fetchPlayerData(
    sessionId: string
  ): Promise<{ name: string; party: PubMon[]; activeIndex: number } | null> {
    try {
      // Fetch player data from MainEventServer via RPC
      const mainServerUrl = `${this.env.PARTYKIT_URL}/parties/main/global`;
      const response = await fetch(`${mainServerUrl}/rpc/player/${sessionId}`);

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error("[BattleServer] Failed to fetch player data:", error);
      return null;
    }
  }

  private async reportBattleResult(winnerId: string) {
    try {
      const mainServerUrl = `${this.env.PARTYKIT_URL}/parties/main/global`;
      await fetch(`${mainServerUrl}/rpc/battle-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battleId: this.name,
          winnerId,
        }),
      });
    } catch (error) {
      console.error("[BattleServer] Failed to report battle result:", error);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private broadcastMessage(message: BattleServerMessage) {
    this.broadcast(JSON.stringify(message));
  }

  private sendError(connection: Connection, message: string) {
    connection.send(
      JSON.stringify({
        type: "battle_error",
        message,
      })
    );
  }
}
