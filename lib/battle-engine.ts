import { BattleStreams, RandomPlayerAI, Teams, Dex } from "@pkmn/sim";
import { Battle } from "@pkmn/client";
import { type ID } from "@pkmn/dex-types";
import { Generations } from "@pkmn/data";
import { generatePubMonModData, type PubMon } from "@/lib/pokemon-data";
import type PartySocket from "partysocket";

// Custom dex and generations for PubMon mod
const customDex = Dex.mod("pubmon" as ID, generatePubMonModData() as any);
const gens = new Generations(customDex);

/**
 * BattleEngine interface - abstraction for both local and remote battles
 *
 * This interface allows the UI to be completely agnostic to whether the battle
 * is happening locally (wild encounters) or remotely (P2P multiplayer).
 */
export interface BattleEngine {
	/**
	 * Initialize battle with teams
	 * @param p1Team Packed team string for player 1
	 * @param p2Team Packed team string for player 2
	 */
	start(p1Team: string, p2Team: string): void;

	/**
	 * Submit move (returns immediately for optimistic local prediction)
	 * @param moveIndex 0-based move index
	 */
	submitMove(moveIndex: number): void;

	/**
	 * Forfeit turn (e.g., failed escape attempt)
	 * Engine will emit |cant| message with escape reason
	 */
	forfeitTurn(): void;

	/**
	 * Event stream (protocol chunks)
	 * @param callback Function called with each protocol chunk
	 */
	onChunk(callback: (chunk: string) => void): void;

	/**
	 * Cleanup resources
	 */
	destroy(): void;
}

/**
 * LocalBattleEngine - Wraps @pkmn/sim for local wild encounters
 *
 * This engine runs the entire battle simulation locally with an AI opponent.
 * Used for wild encounters where no network communication is needed.
 */
export class LocalBattleEngine implements BattleEngine {
	private stream: BattleStreams.BattleStream | null = null;
	private p1Stream: BattleStreams.BattlePlayer | null = null;
	private p2AI: RandomPlayerAI | null = null;
	private chunkCallback: ((chunk: string) => void) | null = null;
	private omniscientAbortController: AbortController | null = null;
	private p1AbortController: AbortController | null = null;

	start(p1Team: string, p2Team: string): void {
		// Create battle stream with custom dex
		this.stream = new BattleStreams.BattleStream(
			{ debug: true },
			customDex as any,
		);
		const streams = BattleStreams.getPlayerStreams(this.stream);

		this.p1Stream = streams.p1;

		// Start AI for p2
		this.p2AI = new RandomPlayerAI(streams.p2);
		console.log("[LocalBattleEngine] Starting p2 AI...");
		void this.p2AI
			.start()
			.then(() => {
				console.log("[LocalBattleEngine] p2 AI started successfully");
			})
			.catch((error: any) => {
				console.error("[LocalBattleEngine] Error starting p2 AI:", error);
			});

		// Listen to omniscient stream for battle messages
		this.omniscientAbortController = new AbortController();
		void (async () => {
			try {
				for await (const chunk of streams.omniscient) {
					if (this.omniscientAbortController?.signal.aborted) break;
					if (this.chunkCallback) {
						this.chunkCallback(chunk);
					}
				}
			} catch (error) {
				if (!this.omniscientAbortController?.signal.aborted) {
					console.error(
						"[LocalBattleEngine] Error in omniscient stream:",
						error,
					);
				}
			}
		})();

		// Listen to p1 stream for request data
		this.p1AbortController = new AbortController();
		void (async () => {
			try {
				for await (const chunk of streams.p1) {
					if (this.p1AbortController?.signal.aborted) break;
					console.debug("[LocalBattleEngine] P1 stream chunk:", chunk);
					// Only forward p1-specific request chunks, not general battle events
					// This prevents duplicate message processing (omniscient stream handles battle events)
					if (this.chunkCallback && chunk.includes("|request|")) {
						this.chunkCallback(chunk);
					}
				}
			} catch (error) {
				if (!this.p1AbortController?.signal.aborted) {
					console.error("[LocalBattleEngine] Error in p1 stream:", error);
				}
			}
		})();

		// Start the battle
		streams.omniscient.write(
			`>start {"formatid":"gen1pubmon"}\n` +
				`>player p1 {"name":"Player","team":"${p1Team}"}\n` +
				`>player p2 {"name":"Wild PubMon","team":"${p2Team}"}`,
		);
	}

	submitMove(moveIndex: number): void {
		if (!this.p1Stream) {
			console.error("[LocalBattleEngine] p1Stream is null!");
			return;
		}

		const command = `move ${moveIndex + 1}`;
		console.log("[LocalBattleEngine] Writing command:", command);
		this.p1Stream.write(command);
	}

	forfeitTurn(): void {
		if (!this.p1Stream) {
			console.error("[LocalBattleEngine] p1Stream is null!");
			return;
		}

		// Send cant command for failed escape
		console.log("[LocalBattleEngine] Forfeiting turn (failed escape)");
		this.p1Stream.write("pass");
	}

	onChunk(callback: (chunk: string) => void): void {
		this.chunkCallback = callback;
	}

	destroy(): void {
		console.log("[LocalBattleEngine] Destroying engine...");

		// Abort async iterators
		this.omniscientAbortController?.abort();
		this.p1AbortController?.abort();

		// Clean up references
		this.chunkCallback = null;
		this.p1Stream = null;
		this.p2AI = null;
		this.stream = null;
	}
}

/**
 * RemoteBattleEngine - WebSocket-based communication with BattleServer for P2P
 *
 * This engine maintains a local @pkmn/sim instance for optimistic prediction
 * while sending moves to an authoritative BattleServer. It compares server
 * events with local predictions and triggers rollback if there's a mismatch.
 */
export class RemoteBattleEngine implements BattleEngine {
	private battleId: string;
	private sessionId: string;
	private socket: PartySocket;

	// Local prediction engine
	private localEngine: LocalBattleEngine | null = null;
	private predictedEvents: string[] = [];

	// Server state
	private serverEventLog: string[] = [];
	private chunkCallback: ((chunk: string) => void) | null = null;

	// Reconciliation
	private reconciliationCount = 0;
	private maxReconciliationAttempts = 3;

	constructor(battleId: string, sessionId: string, socket: PartySocket) {
		this.battleId = battleId;
		this.sessionId = sessionId;
		this.socket = socket;

		// Listen for battle_update messages from server
		this.socket.addEventListener("message", this.handleServerMessage);
	}

	private handleServerMessage = (event: MessageEvent) => {
		try {
			const msg = JSON.parse(event.data);

			if (msg.type === "battle_update" && Array.isArray(msg.events)) {
				console.log("[RemoteBattleEngine] Received battle_update:", msg.events);

				// Append to server event log
				this.serverEventLog.push(...msg.events);

				// Check for desync
				const desync = this.detectDesync(msg.events);

				if (desync) {
					console.warn("[RemoteBattleEngine] DESYNC DETECTED!");
					this.reconciliationCount++;

					if (this.reconciliationCount > this.maxReconciliationAttempts) {
						console.error(
							"[RemoteBattleEngine] Max reconciliation attempts exceeded. Force resync.",
						);
						this.forceResync();
					} else {
						this.rollbackAndReplay();
					}
				} else {
					// No desync - forward server events to UI
					const chunk = msg.events.join("\n");
					if (this.chunkCallback) {
						this.chunkCallback(chunk);
					}
				}
			}
		} catch (error) {
			console.error(
				"[RemoteBattleEngine] Error handling server message:",
				error,
			);
		}
	};

	start(p1Team: string, p2Team: string): void {
		// Create local prediction engine
		this.localEngine = new LocalBattleEngine();

		// Capture predicted events
		this.localEngine.onChunk((chunk) => {
			const lines = chunk.split("\n").filter((line) => line.length > 0);
			this.predictedEvents.push(...lines);
		});

		// Start local prediction
		this.localEngine.start(p1Team, p2Team);

		// Join battle on server
		this.socket.send(
			JSON.stringify({
				type: "battle_join",
				sessionId: this.sessionId,
			}),
		);
	}

	submitMove(moveIndex: number): void {
		// Optimistic: run locally first
		if (this.localEngine) {
			this.localEngine.submitMove(moveIndex);
		}

		// Send to server
		this.socket.send(
			JSON.stringify({
				type: "battle_attack",
				sessionId: this.sessionId,
				moveIndex,
			}),
		);
	}

	forfeitTurn(): void {
		// Optimistic: run locally first
		if (this.localEngine) {
			this.localEngine.forfeitTurn();
		}

		// Send to server
		this.socket.send(
			JSON.stringify({
				type: "battle_forfeit",
				sessionId: this.sessionId,
			}),
		);
	}

	onChunk(callback: (chunk: string) => void): void {
		this.chunkCallback = callback;
	}

	destroy(): void {
		console.log("[RemoteBattleEngine] Destroying engine...");

		// Remove message listener
		this.socket.removeEventListener("message", this.handleServerMessage);

		// Destroy local engine
		if (this.localEngine) {
			this.localEngine.destroy();
			this.localEngine = null;
		}

		this.chunkCallback = null;
	}

	/**
	 * Detect desync between predicted events and server events
	 */
	private detectDesync(serverEvents: string[]): boolean {
		// Simple comparison: check if server events match predicted events
		// In production, this would be more sophisticated
		for (let i = 0; i < serverEvents.length; i++) {
			const serverEvent = serverEvents[i];
			const predictedEvent =
				this.predictedEvents[
					this.serverEventLog.length - serverEvents.length + i
				];

			if (serverEvent !== predictedEvent) {
				console.warn("[RemoteBattleEngine] Event mismatch:", {
					server: serverEvent,
					predicted: predictedEvent,
				});
				return true;
			}
		}

		return false;
	}

	/**
	 * Rollback local state and replay server's canonical event log
	 */
	private rollbackAndReplay(): void {
		console.log(
			"[RemoteBattleEngine] Rolling back and replaying server events...",
		);

		// Destroy local engine
		if (this.localEngine) {
			this.localEngine.destroy();
		}

		// Create new Battle instance and replay full server event log
		const battle = new Battle(gens);
		for (const line of this.serverEventLog) {
			try {
				battle.add(line);
			} catch (e) {
				console.error("[RemoteBattleEngine] Error replaying event:", line, e);
			}
		}

		// Sync state with UI
		if (this.chunkCallback) {
			this.chunkCallback(this.serverEventLog.join("\n"));
		}

		// Clear predicted events
		this.predictedEvents = [];
	}

	/**
	 * Force full resync from server (last resort)
	 */
	private forceResync(): void {
		console.error("[RemoteBattleEngine] Forcing full resync...");

		// In production, this would request full state from server
		// For now, just replay server events
		this.rollbackAndReplay();
	}
}
