import { Server, getServerByName, type Connection } from "partyserver";
import type { PubMon } from "../../lib/pokemon-data";
import type {
	BattleState,
	BattlePlayer,
	SerializablePlayerState,
} from "../types/game-state";
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
 * Swap p1<->p2 side identifiers in one protocol line. The sim labels the room
 * creator as p1; the client UI always renders "p1a" as the local player, so we
 * relabel the stream for player 2 to give each client a self-centred view.
 */
function swapProtocolSides(line: string): string {
	// Requests carry the choosable moves as JSON; swap the side fields precisely.
	if (line.startsWith("|request|")) {
		const json = line.slice("|request|".length);
		try {
			const req = JSON.parse(json);
			const flip = (id: string) =>
				id === "p1" ? "p2" : id === "p2" ? "p1" : id;
			if (req.side?.id) req.side.id = flip(req.side.id);
			if (Array.isArray(req.side?.pokemon)) {
				for (const p of req.side.pokemon) {
					if (typeof p.ident === "string") {
						const m = p.ident.match(/^p([12])(.*)$/);
						if (m) p.ident = `p${m[1] === "1" ? "2" : "1"}${m[2]}`;
					}
				}
			}
			return "|request|" + JSON.stringify(req);
		} catch {
			return line;
		}
	}
	// Other lines: side idents (p1, p1a, p2b, ...) only ever appear at the start
	// of a "|"-delimited field, followed by end / ":" / " ".
	return line
		.split("|")
		.map((field) =>
			field.replace(
				/^p([12])([ab]?)(?=$|:| )/,
				(_, n: string, slot: string) =>
					`p${n === "1" ? "2" : "1"}${slot}`,
			),
		)
		.join("|");
}

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
	// Latest per-side `|request|` line, replayed to a reconnecting client so its
	// move menu is restored (these are not part of the omniscient eventLog).
	private lastRequest: { player1?: string; player2?: string } = {};
	private startTime: number = 0;
	private lastMoveAt: number = 0;

	constructor(ctx: DurableObjectState, env: any) {
		super(ctx, env);
	}

	async onStart() {
		console.log(`[BattleServer] Battle room ${this.name} started`);
	}

	async onConnect(connection: Connection) {
		console.log(`[BattleServer] Client connected: ${connection.id}`);

		// Bring late joiners / spectators (e.g. the admin console) up to speed
		// with the current battle state, including timing, so they can render
		// total/idle timers immediately.
		if (this.battleState && this.battleState.status === "active") {
			this.sendBattleStateTo(connection);
		}
	}

	/** Force the battle to end and notify both players (Main->Battle RPC). */
	async onRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (
			request.method === "POST" &&
			url.pathname.endsWith("/rpc/end-battle")
		) {
			const body = await request.json<{
				winnerId: string | null;
				reason: "admin" | "void";
			}>();
			await this.forceEnd(body.winnerId, body.reason);
			return Response.json({ success: true });
		}
		return new Response("Not found", { status: 404 });
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

		if (!this.battleState) return;

		// Map the closing connection back to its session. (connection.id is the
		// transport id, NOT the player's sessionId, so we look it up.)
		let sessionId: string | undefined;
		for (const [sid, conn] of this.connectionMap) {
			if (conn === connection) {
				sessionId = sid;
				break;
			}
		}
		if (!sessionId) return;

		// Grace period: mark the player disconnected but DON'T auto-forfeit. They
		// may reconnect and resume (e.g. a page reload / dev StrictMode remount).
		// Forfeits/voids are handled explicitly by the admin; there is no move
		// timeout.
		if (this.battleState.player1.sessionId === sessionId) {
			this.battleState.player1.connected = false;
		} else if (this.battleState.player2.sessionId === sessionId) {
			this.battleState.player2.connected = false;
		}
	}

	// ============================================================================
	// Message Handlers
	// ============================================================================

	private async handleBattleJoin(
		msg: Extract<BattleClientMessage, { type: "battle_join" }>,
		connection: Connection,
	) {
		// Reconnection: this session is already a participant. Restore its
		// connection and replay the battle from the start so the client can
		// rebuild HP / log / move-menu state. (Also covers the dev StrictMode
		// remount, which tears down and recreates the client engine.)
		if (this.battleState) {
			const slot =
				this.battleState.player1.sessionId === msg.sessionId
					? "player1"
					: this.battleState.player2.sessionId === msg.sessionId
						? "player2"
						: null;
			if (slot) {
				const player = this.battleState[slot];
				player.connected = true;
				this.connectionMap.set(msg.sessionId, connection);

				// Replay the full canonical protocol from |start|, in this
				// player's perspective.
				if (this.eventLog.length > 0) {
					connection.send(
						JSON.stringify({
							type: "battle_update",
							events: this.perspectiveEvents(slot, [...this.eventLog]),
						}),
					);
				}
				// Restore the move menu.
				const req = this.lastRequest[slot];
				if (req) {
					connection.send(
						JSON.stringify({ type: "battle_update", events: [req] }),
					);
				}
				// Current snapshot (timing etc.) for spectator-style fields.
				this.sendBattleStateTo(connection);

				// If the battle already finished, tell the reconnecting client.
				if (
					this.battleState.status === "completed" &&
					this.battleState.winnerId
				) {
					connection.send(
						JSON.stringify({
							type: "battle_end",
							winnerId: this.battleState.winnerId,
							winnerName:
								this.battleState.player1.sessionId ===
								this.battleState.winnerId
									? this.battleState.player1.name
									: this.battleState.player2.name,
							reason: "natural",
						}),
					);
				}

				console.log(`[BattleServer] ${player.name} reconnected to ${this.name}`);
				return;
			}
		}

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

		// Record activity for the idle timer and push fresh timing to spectators.
		this.lastMoveAt = Date.now();
		await this.broadcastBattleState();

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
		this.lastMoveAt = Date.now();

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
		this.lastMoveAt = this.startTime;

		const customDex = Dex.mod("pubmon" as ID, generatePubMonModData() as any);
		const stream = new BattleStreams.BattleStream(
			{ debug: false },
			customDex as any,
		);
		const streams = BattleStreams.getPlayerStreams(stream);

		this.battleStream = stream;
		this.p1Stream = streams.p1;
		this.p2Stream = streams.p2;

		// Listen to omniscient stream (full battle log -> both players).
		(async () => {
			try {
				for await (const chunk of streams.omniscient) {
					this.handleEngineChunk(chunk);
				}
			} catch (error) {
				console.error("[BattleServer] Error in omniscient stream:", error);
			}
		})();

		// The omniscient stream does NOT carry per-side `|request|` messages —
		// those tell each client which moves are choosable and drive the move
		// menu. Forward each player stream's `|request|` lines to that player.
		const pipeRequests = (
			stream: AsyncIterable<string>,
			slot: "player1" | "player2",
		) => {
			void (async () => {
				try {
					for await (const chunk of stream) {
						let lines = chunk
							.split("\n")
							.filter((line) => line.startsWith("|request|"));
						if (lines.length === 0) continue;
						// Relabel to this player's perspective (player2 -> p1a).
						lines = this.perspectiveEvents(slot, lines);
						// Remember the latest (perspective-correct) request so we can
						// restore the move menu for a reconnecting client.
						this.lastRequest[slot] = lines[lines.length - 1];
						const sid = this.battleState?.[slot].sessionId;
						const conn = sid ? this.connectionMap.get(sid) : undefined;
						if (conn) {
							conn.send(
								JSON.stringify({ type: "battle_update", events: lines }),
							);
						}
					}
				} catch (error) {
					console.error("[BattleServer] Error in player stream:", error);
				}
			})();
		};
		pipeRequests(streams.p1, "player1");
		pipeRequests(streams.p2, "player2");

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

		// Append to canonical event log (player1's perspective is canonical).
		this.eventLog.push(...lines);

		// Send each player their own perspective (player2 sees themselves as p1a).
		this.sendBattleEvents(lines);

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

	private async endBattle(
		winnerId: string,
		reason: "natural" | "forfeit" = "natural",
	) {
		if (!this.battleState) return;

		this.battleState.status = "completed";
		this.battleState.winnerId = winnerId;

		const winner =
			this.battleState.player1.sessionId === winnerId
				? this.battleState.player1
				: this.battleState.player2;

		// Broadcast battle end (threads through to each client's battle hook).
		this.broadcastMessage({
			type: "battle_end",
			winnerId,
			winnerName: winner?.name ?? "",
			reason,
		});

		// Report result back to MainEventServer
		await this.reportBattleResult(winnerId);

		// Close connections after a delay
		setTimeout(() => {
			this.broadcast("BATTLE_COMPLETE");
			// Connections will auto-close
		}, 3000);
	}

	/**
	 * Force the battle to end on the MainEventServer's authority (admin resolve
	 * / void). Notifies both players via battle_end. Does NOT report back to the
	 * MainEventServer — it already owns the decision.
	 */
	private async forceEnd(winnerId: string | null, reason: "admin" | "void") {
		if (!this.battleState) return;
		if (this.battleState.status === "completed") return; // idempotent

		this.battleState.status = "completed";
		this.battleState.winnerId = winnerId ?? undefined;

		const winnerName = winnerId
			? this.battleState.player1.sessionId === winnerId
				? this.battleState.player1.name
				: this.battleState.player2.name
			: "";

		this.broadcastMessage({
			type: "battle_end",
			winnerId: winnerId ?? "",
			winnerName,
			reason,
		});

		setTimeout(() => {
			this.broadcast("BATTLE_COMPLETE");
		}, 3000);
	}

	/** Build the current battle_state message, or null if not renderable yet. */
	private buildBattleState(): BattleServerMessage | null {
		if (!this.battleState) return null;

		const player1Mon =
			this.battleState.player1.party[this.battleState.player1.activeIndex];
		const player2Mon =
			this.battleState.player2.party[this.battleState.player2.activeIndex];

		if (!player1Mon || !player2Mon) return null;

		return {
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
			startedAt: this.startTime,
			lastMoveAt: this.lastMoveAt,
			serverNow: Date.now(),
		};
	}

	private async broadcastBattleState() {
		const state = this.buildBattleState();
		if (state) this.broadcastMessage(state);
	}

	private sendBattleStateTo(connection: Connection) {
		const state = this.buildBattleState();
		if (state) connection.send(JSON.stringify(state));
	}

	/** Relabel events for a player's perspective (player2 sees themselves p1a). */
	private perspectiveEvents(
		slot: "player1" | "player2",
		lines: string[],
	): string[] {
		return slot === "player2" ? lines.map(swapProtocolSides) : lines;
	}

	/** Send a battle_update to each player in their own perspective. */
	private sendBattleEvents(lines: string[]) {
		if (!this.battleState) return;
		const p1 = this.connectionMap.get(this.battleState.player1.sessionId);
		const p2 = this.connectionMap.get(this.battleState.player2.sessionId);
		if (p1) {
			p1.send(JSON.stringify({ type: "battle_update", events: lines }));
		}
		if (p2) {
			p2.send(
				JSON.stringify({
					type: "battle_update",
					events: this.perspectiveEvents("player2", lines),
				}),
			);
		}
	}

	// ============================================================================
	// Communication with MainEventServer
	// ============================================================================

	/** Get a stub for the global MainEventServer durable object. */
	private async mainEventServer() {
		return getServerByName(this.env.MAIN_EVENT_SERVER, "global");
	}

	private async fetchPlayerData(
		sessionId: string,
	): Promise<{ name: string; party: PubMon[]; activeIndex: number } | null> {
		try {
			// Fetch player data directly from the MainEventServer DO (no network
			// hop / PARTYKIT_URL needed — both live in the same worker).
			const stub = await this.mainEventServer();
			const response = await stub.fetch(
				`https://do/parties/main/global/rpc/player/${sessionId}`,
			);

			if (!response.ok) return null;

			// The RPC returns the full serialized player state; extract the
			// battle slice we need.
			const data = (await response.json()) as SerializablePlayerState;
			return {
				name: data.info.name,
				party: data.party,
				activeIndex: data.activeIndex,
			};
		} catch (error) {
			console.error("[BattleServer] Failed to fetch player data:", error);
			return null;
		}
	}

	private async reportBattleResult(winnerId: string) {
		try {
			const stub = await this.mainEventServer();
			await stub.fetch(`https://do/parties/main/global/rpc/battle-complete`, {
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
