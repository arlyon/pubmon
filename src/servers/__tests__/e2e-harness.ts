/**
 * Shared helpers for the live-server tournament E2E tests.
 *
 * Spins up a real `wrangler dev` process and drives it over WebSockets:
 *   - WSClient        — a main-room (or admin) connection with a message log
 *   - startWrangler   — boot a worker on a fixed port, poll /health
 *   - createAndSetup  — connect + create player + pick starter
 *   - playBattle      — join a BattleServer room and drive a real @pkmn/sim
 *                       battle to completion (or until the match is resolved
 *                       externally, e.g. an admin kick)
 *   - runPlayerAgent  — autonomous player: keeps playing matches while the
 *                       server keeps pairing it
 *
 * Battles are driven off the public `|turn|` log: the BattleServer only
 * forwards `streams.omniscient`, never the per-side `|request|` messages (in
 * production the client's RemoteBattleEngine predicts those locally). Submitting
 * a move on each new turn — routed by sessionId, which the BattleServer maps to
 * the correct sim side — is enough to play a battle to a |win|.
 */
import { spawn, type Subprocess } from "bun";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type {
	ServerMessage,
	BattleServerMessage,
} from "../../types/messages";
import type { TournamentBracket, TournamentMatch } from "../types/game-state";

export const ADMIN_SECRET = "change-me-in-production"; // matches wrangler.jsonc

// ─── Wrangler subprocess ────────────────────────────────────────────────────

export interface WranglerHandle {
	proc: Subprocess;
	tmpDir: string;
	port: number;
}

export async function startWrangler(port: number): Promise<WranglerHandle> {
	const dir = mkdtempSync(join(tmpdir(), "pubmon-e2e-"));
	const proc = spawn(
		[
			"npx",
			"wrangler",
			"dev",
			"src/index.ts",
			"--port",
			String(port),
			"--config",
			"wrangler.jsonc",
			"--persist-to",
			dir,
		],
		{ cwd: process.cwd(), stdout: "inherit", stderr: "inherit" },
	);

	const startTime = Date.now();
	while (Date.now() - startTime < 30_000) {
		try {
			const resp = await fetch(`http://127.0.0.1:${port}/health`);
			if (resp.ok) return { proc, tmpDir: dir, port };
		} catch {
			// not up yet
		}
		await Bun.sleep(250);
	}
	proc.kill();
	throw new Error("wrangler did not become healthy in time");
}

export function stopWrangler(handle: WranglerHandle | undefined) {
	handle?.proc.kill();
	try {
		if (handle) rmSync(handle.tmpDir, { recursive: true, force: true });
	} catch {}
}

// ─── Main-room WebSocket client ─────────────────────────────────────────────

export class WSClient {
	private ws: WebSocket;
	messages: ServerMessage[] = [];
	private _ready: Promise<void>;

	constructor(url: string) {
		this.ws = new WebSocket(url);
		this._ready = new Promise((resolve, reject) => {
			this.ws.onopen = () => resolve();
			this.ws.onerror = (e) => reject(e);
		});
		this.ws.onmessage = (ev) => {
			try {
				this.messages.push(JSON.parse(String(ev.data)));
			} catch {
				/* ignore non-JSON */
			}
		};
	}

	async ready() {
		await this._ready;
	}

	send(msg: Record<string, unknown>) {
		this.ws.send(JSON.stringify(msg));
	}

	async waitFor<T extends ServerMessage["type"]>(
		type: T,
		timeoutMs = 5000,
	): Promise<Extract<ServerMessage, { type: T }>> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const found = this.messages.find(
				(m): m is Extract<ServerMessage, { type: T }> => m.type === type,
			);
			if (found) return found;
			await Bun.sleep(50);
		}
		throw new Error(
			`Timed out waiting for "${type}". Got: [${this.messages
				.map((m) => m.type)
				.join(", ")}]`,
		);
	}

	ofType<T extends ServerMessage["type"]>(
		type: T,
	): Extract<ServerMessage, { type: T }>[] {
		return this.messages.filter(
			(m): m is Extract<ServerMessage, { type: T }> => m.type === type,
		);
	}

	close() {
		this.ws.close();
	}
}

// ─── Player setup ───────────────────────────────────────────────────────────

export interface E2EPlayer {
	client: WSClient;
	sessionId: string;
	name: string;
}

export async function connectMain(port: number): Promise<WSClient> {
	const client = new WSClient(`ws://127.0.0.1:${port}/parties/main/global`);
	await client.ready();
	await client.waitFor("gym_update");
	return client;
}

export async function createAndSetup(
	port: number,
	name: string,
	starterId: number,
): Promise<E2EPlayer> {
	const sessionId = `e2e_${name}_${Date.now()}_${Math.floor(
		performance.now(),
	)}`;
	const client = await connectMain(port);

	client.send({
		type: "create_player",
		sessionId,
		playerInfo: { name, sprite: "boy" },
	});
	await client.waitFor("player_created");

	client.send({ type: "select_starter", sessionId, pubmonId: starterId });
	await client.waitFor("starter_selected");

	return { client, sessionId, name };
}

// ─── Bracket helpers ──────────────────────────────────────────────────────

/** Find the match in a bracket that a given session is a participant of. */
export function findMatchForSession(
	bracket: TournamentBracket,
	sessionId: string,
): TournamentMatch | undefined {
	return bracket.matches.find(
		(m) =>
			m.player1SessionId === sessionId || m.player2SessionId === sessionId,
	);
}

/**
 * Find the next match_start for `sessionId` whose battleId we haven't played
 * yet. Resolves to null on timeout (player eliminated / tournament over / a
 * champion already crowned).
 */
export async function nextMatchStartFor(
	client: WSClient,
	sessionId: string,
	played: Set<string>,
	timeoutMs: number,
): Promise<Extract<ServerMessage, { type: "match_start" }> | null> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const ms = client
			.ofType("match_start")
			.find(
				(m) =>
					!played.has(m.battleId) &&
					(m.player1SessionId === sessionId ||
						m.player2SessionId === sessionId),
			);
		if (ms) return ms;
		const champ = client
			.ofType("bracket_update")
			.find((m) => (m.bracket as TournamentBracket).champion);
		if (champ) return null;
		await Bun.sleep(50);
	}
	return null;
}

// ─── Battle driver ────────────────────────────────────────────────────────

/**
 * Play one battle in a BattleServer room. Submits a move at the start of every
 * turn in the public battle log. Resolves with the winner's sessionId when the
 * room reports battle_end, OR when the match is resolved externally (a
 * match_complete for this battleId arrives on the main connection — e.g. the
 * admin kicked an unresponsive opponent). Returns null if the battle neither
 * finishes nor is resolved within the timeout.
 */
export async function playBattle(
	port: number,
	battleId: string,
	sessionId: string,
	mainClient: WSClient,
	timeoutMs = 30_000,
): Promise<string | null> {
	const url = `ws://127.0.0.1:${port}/parties/battle/${battleId}`;
	const ws = new WebSocket(url);
	const movedTurns = new Set<number>();
	let winnerId: string | null = null;

	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = (e) => reject(e);
	});

	const submitForTurn = (turn: number) => {
		if (movedTurns.has(turn)) return;
		movedTurns.add(turn);
		ws.send(
			JSON.stringify({ type: "battle_attack", sessionId, moveIndex: 0 }),
		);
	};

	ws.onmessage = (ev) => {
		let msg: BattleServerMessage;
		try {
			msg = JSON.parse(String(ev.data));
		} catch {
			return;
		}
		if (msg.type === "battle_end") {
			winnerId = msg.winnerId;
			return;
		}
		if (msg.type === "battle_update") {
			for (const line of msg.events) {
				if (line.startsWith("|turn|")) {
					const turn = parseInt(line.slice("|turn|".length), 10);
					if (!Number.isNaN(turn)) submitForTurn(turn);
				}
			}
		}
	};

	// Joining triggers battle init once both players are present.
	ws.send(JSON.stringify({ type: "battle_join", sessionId }));

	const start = Date.now();
	while (winnerId === null && Date.now() - start < timeoutMs) {
		// The match may be resolved out-of-band (admin kick / forfeit): the
		// main connection receives match_complete and the player leaves the room.
		const mc = mainClient
			.ofType("match_complete")
			.find((m) => m.battleId === battleId);
		if (mc) {
			winnerId = mc.winnerId;
			break;
		}
		await Bun.sleep(50);
	}
	ws.close();
	return winnerId;
}

/**
 * Autonomous player agent: keeps playing matches as long as the server keeps
 * pairing this player. Returns the matches it took part in (with winners).
 */
export async function runPlayerAgent(
	port: number,
	player: E2EPlayer,
	opts: { matchWaitMs?: number } = {},
): Promise<Array<{ battleId: string; winnerId: string | null }>> {
	const matchWaitMs = opts.matchWaitMs ?? 15_000;
	const played = new Set<string>();
	const results: Array<{ battleId: string; winnerId: string | null }> = [];

	while (true) {
		const ms = await nextMatchStartFor(
			player.client,
			player.sessionId,
			played,
			matchWaitMs,
		);
		if (!ms) break;
		played.add(ms.battleId);
		const winnerId = await playBattle(
			port,
			ms.battleId,
			player.sessionId,
			player.client,
		);
		results.push({ battleId: ms.battleId, winnerId });
		// Eliminated (or unresolved) -> stop. Won -> loop for the next round.
		if (winnerId !== player.sessionId) break;
	}

	return results;
}

// ─── Admin helpers ──────────────────────────────────────────────────────────

export async function adminState(admin: WSClient): Promise<any> {
	admin.messages = admin.messages.filter((m) => m.type !== "admin_state");
	admin.send({ type: "admin_request_state", adminSecret: ADMIN_SECRET });
	const state = await admin.waitFor("admin_state", 5000);
	return (state as any).state;
}
