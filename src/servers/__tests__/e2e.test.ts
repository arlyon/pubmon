/**
 * E2E test — starts a wrangler dev server as a subprocess and drives
 * the tournament flow via WebSocket.
 *
 * Note: unstable_dev doesn't work under bun, so we spawn wrangler dev
 * as a child process and connect to it.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn, type Subprocess } from "bun";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { ServerMessage } from "../../types/messages";

const ADMIN_SECRET = "change-me-in-production"; // matches wrangler.jsonc vars

// ─── Wrangler subprocess ────────────────────────────────────────────────────

let proc: Subprocess;
let port: number;
let tmpDir: string;

async function startWrangler(): Promise<{ proc: Subprocess; port: number; tmpDir: string }> {
	const tmpDir = mkdtempSync(join(tmpdir(), "pubmon-e2e-"));
	const proc = spawn(
		[
			"npx", "wrangler", "dev", "src/index.ts",
			"--port", "0",
			"--config", "wrangler.jsonc",
			"--persist-to", tmpDir,
		],
		{
			cwd: process.cwd(),
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	// Wait for "Ready on" line to get the port
	const decoder = new TextDecoder();
	const reader = proc.stdout.getReader();
	const startTime = Date.now();

	let buffer = "";
	while (Date.now() - startTime < 20_000) {
		const { value, done } = await reader.read();
		if (done) throw new Error("wrangler exited before ready");
		buffer += decoder.decode(value);

		// wrangler prints: "Ready on http://localhost:PORT"
		const match = buffer.match(/Ready on http:\/\/[^:]+:(\d+)/);
		if (match) {
			reader.releaseLock();
			return { proc, port: parseInt(match[1]), tmpDir };
		}
	}
	proc.kill();
	throw new Error(`wrangler did not start in time. Output: ${buffer}`);
}

// ─── WebSocket client helper ────────────────────────────────────────────────

class WSClient {
	private ws: WebSocket;
	private messages: ServerMessage[] = [];
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
				// ignore non-JSON
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
			`Timed out waiting for "${type}". Got: [${this.messages.map((m) => m.type).join(", ")}]`,
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

// ─── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
	const result = await startWrangler();
	proc = result.proc;
	port = result.port;
	tmpDir = result.tmpDir;
}, 30_000);

afterAll(() => {
	proc?.kill();
	try {
		rmSync(tmpDir, { recursive: true, force: true });
	} catch {}
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function connectMain(): Promise<WSClient> {
	const client = new WSClient(`ws://127.0.0.1:${port}/parties/main/global`);
	await client.ready();
	await client.waitFor("gym_update");
	return client;
}

async function createAndSetup(
	name: string,
	starterId: number,
): Promise<{ client: WSClient; sessionId: string }> {
	const sessionId = `e2e_${name}_${Date.now()}`;
	const client = await connectMain();

	client.send({
		type: "create_player",
		sessionId,
		playerInfo: { name, sprite: "boy" },
	});
	await client.waitFor("player_created");

	client.send({ type: "select_starter", sessionId, pubmonId: starterId });
	await client.waitFor("starter_selected");

	return { client, sessionId };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("E2E — real wrangler server", () => {
	test("health check", async () => {
		const resp = await fetch(`http://127.0.0.1:${port}/health`);
		expect(resp.status).toBe(200);
		expect(await resp.text()).toBe("OK");
	});

	test("connect and receive gym_update", async () => {
		const client = await connectMain();
		const gym = client.ofType("gym_update");
		expect(gym.length).toBeGreaterThan(0);
		// Gym ID depends on existing state — just verify it's a positive number
		expect(gym[0].currentGymId).toBeGreaterThan(0);
		client.close();
	});

	test("full tournament: create players, opt in, admin promote to winner", async () => {
		const alice = await createAndSetup("ALICE_E2E", 1);
		const bob = await createAndSetup("BOB_E2E", 2);

		// Opt in
		alice.client.send({
			type: "opt_in_tournament",
			sessionId: alice.sessionId,
			optIn: true,
		});
		bob.client.send({
			type: "opt_in_tournament",
			sessionId: bob.sessionId,
			optIn: true,
		});
		await alice.client.waitFor("player_state");
		await bob.client.waitFor("player_state");

		// Admin starts tournament
		const admin = await connectMain();
		admin.send({
			type: "admin_start_tournament",
			adminSecret: ADMIN_SECRET,
		});

		// Clients receive tournament_start
		const aliceBracket = await alice.client.waitFor("tournament_start");
		expect(aliceBracket.bracket.round).toBe(1);
		expect(aliceBracket.bracket.matches).toHaveLength(1);

		const match = aliceBracket.bracket.matches[0];

		// Admin promotes Alice
		admin.send({
			type: "admin_promote_player",
			adminSecret: ADMIN_SECRET,
			matchId: match.matchId,
			sessionId: alice.sessionId,
		});

		const update = await admin.waitFor("bracket_update");
		const updatedMatch = update.bracket.matches.find(
			(m) => m.matchId === match.matchId,
		)!;
		expect(updatedMatch.winnerId).toBe(alice.sessionId);
		expect(updatedMatch.adminOverride).toBe(true);

		alice.client.close();
		bob.client.close();
		admin.close();
	});
});
