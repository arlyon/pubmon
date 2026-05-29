/**
 * Test harness for MainEventServer.
 *
 * Provides a lightweight in-process server with mocked partyserver infra
 * (storage, connections, broadcast) so we can drive the full message protocol
 * without wrangler / miniflare overhead.
 */

import { MainEventServer } from "../MainEventServer";
import type { ServerMessage } from "../../types/messages";

// ─── Mock Connection ────────────────────────────────────────────────────────

export class MockConnection {
	id: string;
	messages: ServerMessage[] = [];

	constructor(id: string) {
		this.id = id;
	}

	send(data: string) {
		this.messages.push(JSON.parse(data));
	}

	close() {}

	/** All messages of a given type */
	ofType<T extends ServerMessage["type"]>(
		type: T,
	): Extract<ServerMessage, { type: T }>[] {
		return this.messages.filter(
			(m): m is Extract<ServerMessage, { type: T }> => m.type === type,
		);
	}

	/** Most recent message of a given type */
	latest<T extends ServerMessage["type"]>(
		type: T,
	): Extract<ServerMessage, { type: T }> | undefined {
		const msgs = this.ofType(type);
		return msgs[msgs.length - 1];
	}

	clear() {
		this.messages = [];
	}
}

// ─── Mock Durable Object Storage ────────────────────────────────────────────

class MockStorage {
	private data = new Map<string, unknown>();
	async get<T>(key: string): Promise<T | undefined> {
		return this.data.get(key) as T | undefined;
	}
	async put(key: string, value: unknown) {
		this.data.set(key, value);
	}
	async delete(key: string) {
		this.data.delete(key);
	}
}

// ─── Server wrapper ─────────────────────────────────────────────────────────

export const ADMIN_SECRET = "test-secret";

export interface TestServer {
	server: MainEventServer;
	/** Messages sent via Server.broadcast() (to all connections). */
	broadcasts: ServerMessage[];
	/** Underlying storage — can be shared across server restarts. */
	storage: MockStorage;
}

/** Create a fresh MainEventServer with mocked infra. */
export async function createServer(
	existingStorage?: MockStorage,
): Promise<TestServer> {
	const storage = existingStorage ?? new MockStorage();
	const ctx = { storage } as any;
	const env = { ADMIN_SECRET };

	const server = new MainEventServer(ctx, env);
	const broadcasts: ServerMessage[] = [];
	(server as any).broadcast = (data: string) => {
		broadcasts.push(JSON.parse(data));
	};

	await (server as any).onStart();
	return { server, broadcasts, storage };
}

// ─── Protocol helpers ───────────────────────────────────────────────────────

export async function send(
	server: MainEventServer,
	conn: MockConnection,
	msg: Record<string, unknown>,
) {
	await (server as any).onMessage(conn, JSON.stringify(msg));
}

export async function connect(server: MainEventServer, conn: MockConnection) {
	await (server as any).onConnect(conn);
}

/** Simulate BattleServer reporting a result via the HTTP RPC endpoint. */
export async function completeBattle(
	server: MainEventServer,
	battleId: string,
	winnerId: string,
) {
	await (server as any).completeBattleMatch(battleId, winnerId);
}

// ─── Fixture helpers ────────────────────────────────────────────────────────

export interface TestPlayer {
	sessionId: string;
	conn: MockConnection;
	name: string;
}

/** Create a player with a starter PubMon ready to go. */
export async function createPlayer(
	server: MainEventServer,
	name: string,
	starterId = 1,
): Promise<TestPlayer> {
	const sessionId = `session_${name}`;
	const conn = new MockConnection(sessionId);
	await connect(server, conn);

	await send(server, conn, {
		type: "create_player",
		sessionId,
		playerInfo: { name, sprite: "boy" },
	});

	await send(server, conn, {
		type: "select_starter",
		sessionId,
		pubmonId: starterId,
	});

	return { sessionId, conn, name };
}

/** Opt a player into the tournament. */
export async function optIn(
	server: MainEventServer,
	player: TestPlayer,
	value = true,
) {
	await send(server, player.conn, {
		type: "opt_in_tournament",
		sessionId: player.sessionId,
		optIn: value,
	});
}

/** Log a fight for a player (bumps their battleLog.length for seeding). */
export async function logFight(
	server: MainEventServer,
	player: TestPlayer,
	pubmonId = 10,
) {
	await send(server, player.conn, {
		type: "fight",
		sessionId: player.sessionId,
		pubmonId,
		battleStartTime: Date.now(),
		battleEndTime: Date.now(),
		outcome: "win",
	});
}

/** Admin: start the tournament. */
export async function adminStartTournament(
	server: MainEventServer,
	adminConn: MockConnection,
) {
	await send(server, adminConn, {
		type: "admin_start_tournament",
		adminSecret: ADMIN_SECRET,
	});
}

/** Admin: request full debug state. */
export async function adminRequestState(
	server: MainEventServer,
	adminConn: MockConnection,
) {
	await send(server, adminConn, {
		type: "admin_request_state",
		adminSecret: ADMIN_SECRET,
	});
	return adminConn.latest("admin_state") as any;
}

/** Convenience: create N players, opt them all in, return the array. */
export async function createTournamentPlayers(
	server: MainEventServer,
	count: number,
): Promise<TestPlayer[]> {
	const names = [
		"ALICE",
		"BOB",
		"CAROL",
		"DAVE",
		"EVE",
		"FRANK",
		"GRACE",
		"HANK",
		"IVY",
		"JACK",
		"KATE",
		"LIAM",
		"MIA",
		"NOAH",
		"OLIVIA",
		"PETE",
	];
	const players: TestPlayer[] = [];
	for (let i = 0; i < count; i++) {
		const p = await createPlayer(server, names[i], (i % 5) + 1);
		players.push(p);
	}
	for (const p of players) await optIn(server, p);
	return players;
}

/** Pull the latest bracket from broadcast messages. */
export function latestBracket(
	broadcasts: ServerMessage[],
	round?: number,
): Extract<ServerMessage, { type: "tournament_start" }> | undefined {
	const starts = broadcasts.filter(
		(m): m is Extract<ServerMessage, { type: "tournament_start" }> =>
			m.type === "tournament_start",
	);
	if (round !== undefined) return starts.find((s) => s.bracket.round === round);
	return starts[starts.length - 1];
}

/**
 * Get match_start broadcasts — these have the battleId which is NOT present
 * in the tournament_start broadcast (it's assigned after the broadcast).
 */
export function matchStarts(
	broadcasts: ServerMessage[],
): Extract<ServerMessage, { type: "match_start" }>[] {
	return broadcasts.filter(
		(m): m is Extract<ServerMessage, { type: "match_start" }> =>
			m.type === "match_start",
	);
}

/** Find the battleId for a match between two session IDs. */
export function findBattleId(
	broadcasts: ServerMessage[],
	sessionId1: string,
	sessionId2: string,
): string {
	const starts = matchStarts(broadcasts);
	const match = starts.find(
		(m) =>
			(m.player1SessionId === sessionId1 &&
				m.player2SessionId === sessionId2) ||
			(m.player1SessionId === sessionId2 &&
				m.player2SessionId === sessionId1),
	);
	if (!match) {
		throw new Error(
			`No match_start found for ${sessionId1} vs ${sessionId2}`,
		);
	}
	return match.battleId;
}

/**
 * Get the live bracket state from admin_request_state (has battleIds set,
 * unlike the tournament_start broadcast).
 */
export async function getLiveBracket(
	server: MainEventServer,
	adminConn: MockConnection,
) {
	const state = await adminRequestState(server, adminConn);
	return state.state.tournamentBracket;
}
