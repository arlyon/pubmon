import { expect, test, describe, beforeEach } from "bun:test";
import { RemoteBattleEngine } from "@/lib/battle-engine";

/**
 * Mock PartySocket that tracks sent messages and allows simulating incoming
 * server messages. Injected into the engine via the constructor's `socket`
 * arg, so these tests never open a real connection.
 */
class MockSocket {
	private listeners: Map<string, Set<Function>> = new Map();
	public sentMessages: any[] = [];
	public closed = false;

	addEventListener(event: string, handler: Function) {
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event)!.add(handler);
	}

	removeEventListener(event: string, handler: Function) {
		this.listeners.get(event)?.delete(handler);
	}

	send(data: string) {
		this.sentMessages.push(JSON.parse(data));
	}

	close() {
		this.closed = true;
	}

	/** Simulate an incoming WebSocket message from the server */
	simulateMessage(data: any) {
		const event = { data: JSON.stringify(data) };
		this.listeners.get("message")?.forEach((handler) => handler(event));
	}

	/** Simulate a raw (non-JSON) incoming message */
	simulateRawMessage(raw: string) {
		const event = { data: raw };
		this.listeners.get("message")?.forEach((handler) => handler(event));
	}

	get listenerCount(): number {
		return this.listeners.get("message")?.size ?? 0;
	}
}

describe("RemoteBattleEngine", () => {
	let socket: MockSocket;
	let engine: RemoteBattleEngine;
	const battleId = "test-battle-123";
	const sessionId = "session-abc";

	beforeEach(() => {
		socket = new MockSocket();
		engine = new RemoteBattleEngine(battleId, sessionId, socket as any);
	});

	// --- Construction & Setup ---

	describe("Construction & Setup", () => {
		test("constructor registers a message listener on the socket", () => {
			expect(socket.listenerCount).toBe(1);
		});

		test("start() sends battle_join with sessionId (injected socket)", () => {
			engine.start();

			const joinMsg = socket.sentMessages.find((m) => m.type === "battle_join");
			expect(joinMsg).toBeDefined();
			expect(joinMsg.sessionId).toBe(sessionId);
		});

		test("start() only joins once", () => {
			engine.start();
			engine.start();
			const joins = socket.sentMessages.filter((m) => m.type === "battle_join");
			expect(joins).toHaveLength(1);
		});
	});

	// --- Move Submission ---

	describe("Move Submission", () => {
		test("submitMove() sends battle_attack with moveIndex", () => {
			engine.start();
			engine.submitMove(2);

			const msg = socket.sentMessages.find((m) => m.type === "battle_attack");
			expect(msg).toEqual({ type: "battle_attack", sessionId, moveIndex: 2 });
		});

		test("forfeitTurn() sends battle_forfeit", () => {
			engine.start();
			engine.forfeitTurn();

			const msg = socket.sentMessages.find((m) => m.type === "battle_forfeit");
			expect(msg).toEqual({ type: "battle_forfeit", sessionId });
		});
	});

	// --- Server Event Forwarding (authoritative, no local prediction) ---

	describe("Server event forwarding", () => {
		test("battle_update forwards joined events to the chunk callback", () => {
			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));

			socket.simulateMessage({
				type: "battle_update",
				events: ["|move|p1a: Hoppsin|Hop Splash|p2a: Lagerite", "|-damage|p2a: Lagerite|18/24"],
			});

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toBe(
				"|move|p1a: Hoppsin|Hop Splash|p2a: Lagerite\n|-damage|p2a: Lagerite|18/24",
			);
		});

		test("each battle_update is forwarded as its own chunk (not accumulated)", () => {
			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));

			socket.simulateMessage({ type: "battle_update", events: ["|turn|1"] });
			socket.simulateMessage({ type: "battle_update", events: ["|turn|2"] });

			expect(chunks).toEqual(["|turn|1", "|turn|2"]);
		});

		test("|request| events forward through (drive the move menu)", () => {
			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));

			const requestLine =
				'|request|{"active":[{"moves":[{"move":"Hop Splash","id":"hopsplash"}]}]}';
			socket.simulateMessage({ type: "battle_update", events: [requestLine] });

			expect(chunks).toEqual([requestLine]);
		});

		test("non-battle_update messages are ignored", () => {
			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));

			socket.simulateMessage({ type: "player_joined", name: "Alice" });
			socket.simulateMessage({ type: "chat", text: "hello" });

			expect(chunks).toHaveLength(0);
		});

		test("invalid JSON messages do not crash", () => {
			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));

			expect(() => socket.simulateRawMessage("not valid json{{{")).not.toThrow();
			expect(chunks).toHaveLength(0);
		});

		test("battle_update without an events array is ignored", () => {
			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));

			socket.simulateMessage({ type: "battle_update", events: "not-array" });

			expect(chunks).toHaveLength(0);
		});
	});

	// --- Battle end (natural / forfeit / admin cancel / void) ---

	describe("Battle end handling", () => {
		test("battle_end where we are the winner -> win/natural", () => {
			const ends: any[] = [];
			engine.onEnd((r) => ends.push(r));

			socket.simulateMessage({
				type: "battle_end",
				winnerId: sessionId,
				winnerName: "ME",
				reason: "natural",
			});

			expect(ends).toEqual([{ outcome: "win", reason: "natural" }]);
		});

		test("battle_end where the opponent wins -> loss", () => {
			const ends: any[] = [];
			engine.onEnd((r) => ends.push(r));

			socket.simulateMessage({
				type: "battle_end",
				winnerId: "someone-else",
				winnerName: "THEM",
				reason: "natural",
			});

			expect(ends).toEqual([{ outcome: "loss", reason: "natural" }]);
		});

		test("admin cancel resolving us as winner -> win/admin", () => {
			const ends: any[] = [];
			engine.onEnd((r) => ends.push(r));

			// "battle started then cancelled by the admin" (resolved to a winner).
			socket.simulateMessage({
				type: "battle_end",
				winnerId: sessionId,
				winnerName: "ME",
				reason: "admin",
			});

			expect(ends).toEqual([{ outcome: "win", reason: "admin" }]);
		});

		test("admin void (no winner) -> loss/void", () => {
			const ends: any[] = [];
			engine.onEnd((r) => ends.push(r));

			socket.simulateMessage({
				type: "battle_end",
				winnerId: "",
				winnerName: "",
				reason: "void",
			});

			expect(ends).toEqual([{ outcome: "loss", reason: "void" }]);
		});

		test("battle_end defaults reason to natural when absent", () => {
			const ends: any[] = [];
			engine.onEnd((r) => ends.push(r));

			socket.simulateMessage({ type: "battle_end", winnerId: sessionId });

			expect(ends).toEqual([{ outcome: "win", reason: "natural" }]);
		});

		test("battle_end only fires once even if repeated", () => {
			const ends: any[] = [];
			engine.onEnd((r) => ends.push(r));

			socket.simulateMessage({ type: "battle_end", winnerId: sessionId, reason: "natural" });
			socket.simulateMessage({ type: "battle_end", winnerId: "other", reason: "admin" });

			expect(ends).toHaveLength(1);
			expect(ends[0]).toEqual({ outcome: "win", reason: "natural" });
		});
	});

	// --- Cleanup ---

	describe("Cleanup", () => {
		test("destroy() removes the socket message listener", () => {
			expect(socket.listenerCount).toBe(1);
			engine.destroy();
			expect(socket.listenerCount).toBe(0);
		});

		test("destroy() does NOT close an injected socket", () => {
			engine.destroy();
			expect(socket.closed).toBe(false);
		});

		test("messages after destroy do not reach the callback", () => {
			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));
			engine.destroy();

			socket.simulateMessage({ type: "battle_update", events: ["|turn|1"] });
			expect(chunks).toHaveLength(0);
		});

		test("destroy() can be called multiple times without error", () => {
			expect(() => {
				engine.destroy();
				engine.destroy();
			}).not.toThrow();
		});
	});

	// --- onChunk ---

	describe("onChunk", () => {
		test("onChunk replaces the previous callback", () => {
			const chunks1: string[] = [];
			const chunks2: string[] = [];

			engine.onChunk((chunk) => chunks1.push(chunk));
			engine.onChunk((chunk) => chunks2.push(chunk));

			socket.simulateMessage({ type: "battle_update", events: ["|turn|1"] });

			expect(chunks1).toHaveLength(0);
			expect(chunks2).toEqual(["|turn|1"]);
		});

		test("messages before onChunk is set are not buffered", () => {
			socket.simulateMessage({ type: "battle_update", events: ["|turn|1"] });

			const chunks: string[] = [];
			engine.onChunk((chunk) => chunks.push(chunk));

			expect(chunks).toHaveLength(0);
		});
	});
});
