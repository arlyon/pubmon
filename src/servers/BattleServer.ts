import { Server, type Connection } from "partyserver";
import type { PubMon } from "../../lib/pokemon-data";
import type { BattleState, BattlePlayer } from "../types/game-state";
import type {
	BattleClientMessage,
	BattleServerMessage,
} from "../types/messages";
import { DurableObjectState } from "@cloudflare/workers-types";
import { BattleStreams, Dex, Teams } from "@pkmn/sim";
import { Generations } from "@pkmn/data";
import { generatePubMonModData } from "../../lib/pokemon-data";
import { type ID } from "@pkmn/dex-types";

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

	// Battle engine
	private battleStream: BattleStreams.BattleStream | null = null;
	private p1Stream: BattleStreams.BattlePlayer | null = null;
	private p2Stream: BattleStreams.BattlePlayer | null = null;
	private eventLog: string[] = []; // Full canonical event log
	private startTime: number = 0;

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
		const messageStr =
			typeof message === "string" ? message : new TextDecoder().decode(message);
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
		connection: Connection,
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

			// Initialize battle engine
			await this.initializeBattleEngine();

			// Broadcast initial battle state to both players
			await this.broadcastBattleState();
		} else {
			this.sendError(connection, "Battle is full");
		}
	}

	private async handleBattleAttack(
		msg: Extract<BattleClientMessage, { type: "battle_attack" }>,
		connection: Connection,
	) {
		if (!this.battleState || this.battleState.status !== "active") {
			this.sendError(connection, "Battle not active");
			return;
		}

		// Verify player is in battle
		const isPlayer1 = this.battleState.player1.sessionId === msg.sessionId;
		const isPlayer2 = this.battleState.player2.sessionId === msg.sessionId;

		if (!isPlayer1 && !isPlayer2) {
			this.sendError(connection, "You are not in this battle");
			return;
		}

		// Validate move index
		const currentPlayer = isPlayer1
			? this.battleState.player1
			: this.battleState.player2;
		const attackerMon = currentPlayer.party[currentPlayer.activeIndex];

		if (!attackerMon) {
			this.sendError(connection, "Invalid active PubMon");
			return;
		}

		if (msg.moveIndex < 0 || msg.moveIndex >= attackerMon.moves.length) {
			this.sendError(connection, "Invalid move index");
			return;
		}

		// Forward move to battle stream
		const playerStream = isPlayer1 ? this.p1Stream : this.p2Stream;
		if (!playerStream) {
			this.sendError(connection, "Battle engine not initialized");
			return;
		}

		const command = `move ${msg.moveIndex + 1}`;
		console.log(
			`[BattleServer] Player ${isPlayer1 ? "1" : "2"} submitting move:`,
			command,
		);
		playerStream.write(command);

		// Engine will handle the rest via handleEngineChunk
	}

	private async handleBattleSwitch(
		msg: Extract<BattleClientMessage, { type: "battle_switch" }>,
		connection: Connection,
	) {
		if (!this.battleState || this.battleState.status !== "active") {
			this.sendError(connection, "Battle not active");
			return;
		}

		const isPlayer1 = this.battleState.player1.sessionId === msg.sessionId;
		const currentPlayer = isPlayer1
			? this.battleState.player1
			: this.battleState.player2;

		if (
			msg.newActiveIndex < 0 ||
			msg.newActiveIndex >= currentPlayer.party.length
		) {
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
		this.battleState.currentTurn =
			this.battleState.currentTurn === "player1" ? "player2" : "player1";
		this.battleState.turnCount++;

		await this.broadcastBattleState();
	}

	private async handleBattleForfeit(
		msg: Extract<BattleClientMessage, { type: "battle_forfeit" }>,
		connection: Connection,
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
	// Battle Engine Initialization
	// ============================================================================

	private async initializeBattleEngine() {
		if (!this.battleState) return;

		this.startTime = Date.now();

		const customDex = Dex.mod("pubmon" as ID, generatePubMonModData() as any);
		const stream = new BattleStreams.BattleStream(
			{ debug: false },
			customDex as any,
		);
		const streams = BattleStreams.getPlayerStreams(stream);

		this.battleStream = stream;
		this.p1Stream = streams.p1;
		this.p2Stream = streams.p2;

		// Listen to omniscient stream
		(async () => {
			try {
				for await (const chunk of streams.omniscient) {
					this.handleEngineChunk(chunk);
				}
			} catch (error) {
				console.error("[BattleServer] Error in omniscient stream:", error);
			}
		})();

		// Create team format helper
		const formatId = (name: string) =>
			name.toLowerCase().replace(/[^a-z0-9]+/g, "");

		const createTeam = (player: BattlePlayer) => {
			const activeMon = player.party[player.activeIndex];
			return Teams.pack([
				{
					name: activeMon.name,
					species: formatId(activeMon.name),
					item: "",
					ability: "",
					moves: activeMon.moves.map(formatId),
					nature: "",
					evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
					ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
					level: activeMon.level,
					gender: "M",
				} as any,
			]);
		};

		const p1Team = createTeam(this.battleState.player1);
		const p2Team = createTeam(this.battleState.player2);

		// Start battle
		streams.omniscient.write(
			`>start {"formatid":"gen1pubmon"}\n` +
				`>player p1 {"name":"${this.battleState.player1.name}","team":"${p1Team}"}\n` +
				`>player p2 {"name":"${this.battleState.player2.name}","team":"${p2Team}"}`,
		);

		console.log("[BattleServer] Battle engine initialized");
	}

	private handleEngineChunk(chunk: string) {
		if (!this.battleState) return;

		// Split chunk into lines and filter empty
		const lines = chunk.split("\n").filter((line) => line.length > 0);

		// Append to canonical event log
		this.eventLog.push(...lines);

		// Broadcast to both clients
		this.broadcastMessage({
			type: "battle_update",
			events: lines,
		});

		// Check for |win| event
		for (const line of lines) {
			if (line.startsWith("|win|")) {
				const winner = line.split("|")[2];
				const winnerId =
					winner === this.battleState.player1.name
						? this.battleState.player1.sessionId
						: this.battleState.player2.sessionId;

				void this.endBattle(winnerId);
			}
		}
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

		const player1Mon =
			this.battleState.player1.party[this.battleState.player1.activeIndex];
		const player2Mon =
			this.battleState.player2.party[this.battleState.player2.activeIndex];

		if (!player1Mon || !player2Mon) return;

		this.broadcastMessage({
			type: "battle_state",
			battleId: this.battleState.battleId,
			player1: {
				name: this.battleState.player1.name,
				activePubmon: player1Mon,
				partyCount: this.battleState.player1.party.filter((m) => m.hp > 0)
					.length,
			},
			player2: {
				name: this.battleState.player2.name,
				activePubmon: player2Mon,
				partyCount: this.battleState.player2.party.filter((m) => m.hp > 0)
					.length,
			},
			currentTurn: this.battleState.currentTurn,
			turnCount: this.battleState.turnCount,
		});
	}

	// ============================================================================
	// Communication with MainEventServer
	// ============================================================================

	private async fetchPlayerData(
		sessionId: string,
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
					moveCount: this.battleState?.turnCount || 0,
					duration: Date.now() - this.startTime,
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
			}),
		);
	}
}
