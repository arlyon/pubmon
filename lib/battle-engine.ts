import { BattleStreams, RandomPlayerAI, Teams, Dex } from "@pkmn/sim";
import { type ID } from "@pkmn/dex-types";
import { generatePubMonModData } from "@/lib/pokemon-data";
import PartySocket from "partysocket";

// Custom dex for PubMon mod
const customDex = Dex.mod("pubmon" as ID, generatePubMonModData() as any);

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
	 * Authoritative battle end, decided relative to this engine's player.
	 * Optional: only the remote engine emits this (the server can force-end a
	 * battle, e.g. an admin resolving an unresponsive match). Local battles end
	 * naturally via |win| protocol chunks.
	 */
	onEnd?(
		callback: (result: {
			outcome: "win" | "loss";
			reason: "natural" | "admin" | "forfeit" | "void";
		}) => void,
	): void;

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
 * RemoteBattleEngine - WebSocket client for an authoritative BattleServer (P2P)
 *
 * The BattleServer owns the simulation. This engine simply connects to the
 * battle room, forwards the server's protocol events to the UI, and surfaces
 * the authoritative battle end (natural |win|, forfeit, or an admin
 * resolve/void). There is no local prediction — for a turn-based battle the
 * round-trip is cheap and a single source of truth avoids desync entirely.
 */
export class RemoteBattleEngine implements BattleEngine {
	private battleId: string;
	private sessionId: string;
	private socket: PartySocket;
	/** Whether this engine created (and therefore owns/closes) the socket. */
	private ownsSocket: boolean;

	private chunkCallback: ((chunk: string) => void) | null = null;
	private endCallback:
		| ((result: {
				outcome: "win" | "loss";
				reason: "natural" | "admin" | "forfeit" | "void";
		  }) => void)
		| null = null;
	private ended = false;
	private joinSent = false;

	/**
	 * @param battleId  Battle room id (the BattleServer durable object name).
	 * @param sessionId This client's player session id.
	 * @param socket    Optional pre-built socket (used by tests). When omitted,
	 *                  the engine opens its own connection to the battle room.
	 * @param host      Optional host override for the self-created socket.
	 */
	constructor(
		battleId: string,
		sessionId: string,
		socket?: PartySocket,
		host?: string,
	) {
		this.battleId = battleId;
		this.sessionId = sessionId;

		if (socket) {
			this.socket = socket;
			this.ownsSocket = false;
		} else {
			const resolvedHost =
				host ||
				(typeof process !== "undefined"
					? process.env.NEXT_PUBLIC_SERVER_URL
					: undefined) ||
				"http://localhost:8787";
			// Battles live in their own party/room, NOT the main event room.
			this.socket = new PartySocket({
				host: resolvedHost,
				party: "battle",
				room: battleId,
			});
			this.ownsSocket = true;
		}

		this.socket.addEventListener("message", this.handleServerMessage);
	}

	private handleServerMessage = (event: MessageEvent) => {
		try {
			const msg = JSON.parse(event.data);

			if (msg.type === "battle_end") {
				// Authoritative end (natural |win|, forfeit, or an admin
				// resolve/void). Resolve win/loss against our own sessionId rather
				// than parsing |win| names, which are unreliable remotely.
				if (this.ended) return;
				this.ended = true;
				const outcome: "win" | "loss" =
					msg.winnerId && msg.winnerId === this.sessionId ? "win" : "loss";
				this.endCallback?.({ outcome, reason: msg.reason ?? "natural" });
				return;
			}

			if (msg.type === "battle_update" && Array.isArray(msg.events)) {
				// Forward the server's canonical protocol straight to the UI.
				this.chunkCallback?.(msg.events.join("\n"));
			}
		} catch (error) {
			console.error(
				"[RemoteBattleEngine] Error handling server message:",
				error,
			);
		}
	};

	// Teams are built authoritatively on the server from each player's party,
	// so the client just needs to join the room.
	start(_p1Team?: string, _p2Team?: string): void {
		const sendJoin = () => {
			if (this.joinSent) return;
			this.joinSent = true;
			this.socket.send(
				JSON.stringify({ type: "battle_join", sessionId: this.sessionId }),
			);
		};

		// A self-created socket may not be open yet; join once it connects.
		if (this.ownsSocket && (this.socket as any).readyState !== 1) {
			this.socket.addEventListener("open", sendJoin);
		} else {
			sendJoin();
		}
	}

	submitMove(moveIndex: number): void {
		this.socket.send(
			JSON.stringify({
				type: "battle_attack",
				sessionId: this.sessionId,
				moveIndex,
			}),
		);
	}

	forfeitTurn(): void {
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

	onEnd(
		callback: (result: {
			outcome: "win" | "loss";
			reason: "natural" | "admin" | "forfeit" | "void";
		}) => void,
	): void {
		this.endCallback = callback;
	}

	destroy(): void {
		this.socket.removeEventListener("message", this.handleServerMessage);
		this.chunkCallback = null;
		this.endCallback = null;
		if (this.ownsSocket) {
			try {
				this.socket.close();
			} catch {
				// already closed
			}
		}
	}
}
