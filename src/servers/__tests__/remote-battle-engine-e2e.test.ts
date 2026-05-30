/**
 * Remote battle E2E — two real `RemoteBattleEngine` clients against a live
 * BattleServer durable object (driven through `wrangler dev`).
 *
 * This is the production client path: each engine opens its OWN connection to
 * the `battle/{id}` room, the server streams the authoritative protocol back,
 * and the move menu is driven by the per-side `|request|` messages the server
 * now forwards.
 *
 * Covers:
 *   1. A full battle plays to a natural finish — both engines receive their
 *      `|request|` (move menu) and HP-bearing `|switch|` events, and exactly
 *      one engine ends with outcome "win".
 *   2. "Battle started then cancelled by the admin": once both engines are in
 *      the room, the admin resolves the match. Both engines surface a
 *      `battle_end` (reason "admin"), with the resolved winner/loser — exactly
 *      what the useBattle hook's onEnd handler consumes.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { RemoteBattleEngine } from "@/lib/battle-engine";
import {
	ADMIN_SECRET,
	adminState,
	connectMain,
	createAndSetup,
	startWrangler,
	stopWrangler,
	type WranglerHandle,
} from "./e2e-harness";

const PORT = 8796;

let wrangler: WranglerHandle;

beforeAll(async () => {
	wrangler = await startWrangler(PORT);
}, 40_000);

afterAll(() => stopWrangler(wrangler));

interface EngineEnd {
	outcome: "win" | "loss";
	reason: "natural" | "admin" | "forfeit" | "void";
}

/**
 * Wrap a real RemoteBattleEngine: collect protocol chunks, optionally drive a
 * move at the start of every turn, and expose a promise that resolves on the
 * authoritative battle end.
 */
function makeEngineClient(
	battleId: string,
	sessionId: string,
	opts: { autoplay?: boolean } = {},
) {
	const autoplay = opts.autoplay ?? true;
	const host = `http://127.0.0.1:${PORT}`;
	const engine = new RemoteBattleEngine(battleId, sessionId, undefined, host);

	const chunks: string[] = [];
	const movedTurns = new Set<number>();
	let resolveEnd!: (e: EngineEnd) => void;
	const ended = new Promise<EngineEnd>((r) => {
		resolveEnd = r;
	});

	engine.onEnd((e) => resolveEnd(e));
	engine.onChunk((chunk) => {
		chunks.push(chunk);
		if (!autoplay) return;
		for (const line of chunk.split("\n")) {
			if (line.startsWith("|turn|")) {
				const turn = parseInt(line.slice("|turn|".length), 10);
				if (!Number.isNaN(turn) && !movedTurns.has(turn)) {
					movedTurns.add(turn);
					engine.submitMove(0);
				}
			}
		}
	});

	engine.start();

	const allText = () => chunks.join("\n");
	return {
		engine,
		chunks,
		ended,
		sawRequest: () => chunks.some((c) => c.includes("|request|")),
		sawHpSwitch: () => /\|switch\|.*\d+\/\d+/.test(allText()),
		gotAnyEvents: () => chunks.length > 0,
	};
}

async function waitUntil(pred: () => boolean, timeoutMs: number) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (pred()) return true;
		await Bun.sleep(50);
	}
	return false;
}

describe("RemoteBattleEngine E2E (real DO)", () => {
	test(
		"two engines play a full battle to a natural finish",
		async () => {
			const a = await createAndSetup(PORT, "RBE_ALICE", 1);
			const b = await createAndSetup(PORT, "RBE_BOB", 2);

			const battleId = `rbe_normal_${Date.now()}`;
			const ca = makeEngineClient(battleId, a.sessionId);
			const cb = makeEngineClient(battleId, b.sessionId);

			const [endA, endB] = (await Promise.race([
				Promise.all([ca.ended, cb.ended]),
				Bun.sleep(30_000).then(() => {
					throw new Error("battle did not finish in time");
				}),
			])) as [EngineEnd, EngineEnd];

			// Both engines received the per-side move menu and HP-bearing events.
			expect(ca.sawRequest()).toBe(true);
			expect(cb.sawRequest()).toBe(true);
			expect(ca.sawHpSwitch()).toBe(true);
			expect(cb.sawHpSwitch()).toBe(true);

			// Perspective: each player must see their OWN mon as "p1a". Since the
			// two players have different starters, their p1a switch lines differ.
			const firstP1aSwitch = (chunks: string[]) =>
				chunks
					.join("\n")
					.split("\n")
					.find((l) => l.startsWith("|switch|p1a:"));
			const aP1a = firstP1aSwitch(ca.chunks);
			const bP1a = firstP1aSwitch(cb.chunks);
			expect(aP1a).toBeDefined();
			expect(bP1a).toBeDefined();
			expect(aP1a).not.toBe(bP1a);

			// Exactly one winner, decided naturally.
			expect(endA.reason).toBe("natural");
			expect(endB.reason).toBe("natural");
			const wins = [endA.outcome, endB.outcome].filter((o) => o === "win");
			expect(wins).toHaveLength(1);
			expect(endA.outcome).not.toBe(endB.outcome);

			ca.engine.destroy();
			cb.engine.destroy();
			a.client.close();
			b.client.close();
		},
		60_000,
	);

	test(
		"a reconnecting engine is replayed the battle from the start",
		async () => {
			const a = await createAndSetup(PORT, "RBE_ERIN", 1);
			const b = await createAndSetup(PORT, "RBE_FINN", 2);

			const battleId = `rbe_reconnect_${Date.now()}`;

			// Both join but neither plays, so the battle parks at turn 1 with a
			// known initial protocol (|start|, |switch| HP) + per-side |request|.
			const ca = makeEngineClient(battleId, a.sessionId, { autoplay: false });
			const cb = makeEngineClient(battleId, b.sessionId, { autoplay: false });

			const active = await waitUntil(
				() => ca.sawHpSwitch() && cb.sawHpSwitch(),
				15_000,
			);
			expect(active).toBe(true);

			// Simulate a reconnect (e.g. page reload / StrictMode remount): tear
			// down A's engine and bring up a brand-new one for the same session.
			ca.engine.destroy();
			const ca2 = makeEngineClient(battleId, a.sessionId, { autoplay: false });

			// Without ever playing, the fresh engine must be replayed enough to
			// rebuild its HP/state and move menu.
			const replayed = await waitUntil(
				() => ca2.sawHpSwitch() && ca2.sawRequest(),
				10_000,
			);
			expect(replayed).toBe(true);

			ca2.engine.destroy();
			cb.engine.destroy();
			a.client.close();
			b.client.close();
		},
		60_000,
	);

	test(
		"battle started then cancelled (resolved) by the admin",
		async () => {
			const a = await createAndSetup(PORT, "RBE_CARA", 3);
			const b = await createAndSetup(PORT, "RBE_DREW", 4);

			for (const p of [a, b]) {
				p.client.send({
					type: "opt_in_tournament",
					sessionId: p.sessionId,
					optIn: true,
				});
			}
			await a.client.waitFor("player_state");
			await b.client.waitFor("player_state");

			const admin = await connectMain(PORT);
			admin.send({ type: "admin_start_tournament", adminSecret: ADMIN_SECRET });
			await admin.waitFor("tournament_start", 8000);

			// Grab the live match (matchId + battleId set after the round starts).
			const state = await adminState(admin);
			const match = state.tournamentBracket.matches.find(
				(m: any) => m.status === "in_progress",
			);
			expect(match).toBeDefined();

			// Both players enter the room (battle goes active) but DON'T play.
			const ca = makeEngineClient(match.battleId, match.player1SessionId, {
				autoplay: false,
			});
			const cb = makeEngineClient(match.battleId, match.player2SessionId, {
				autoplay: false,
			});

			// Wait until both engines have received events (battle is active).
			const active = await waitUntil(
				() => ca.gotAnyEvents() && cb.gotAnyEvents(),
				10_000,
			);
			expect(active).toBe(true);

			// Admin resolves the live match to player1.
			admin.send({
				type: "admin_resolve_match",
				adminSecret: ADMIN_SECRET,
				matchId: match.matchId,
				winnerId: match.player1SessionId,
			});

			const [endP1, endP2] = (await Promise.race([
				Promise.all([ca.ended, cb.ended]),
				Bun.sleep(10_000).then(() => {
					throw new Error("admin resolve did not end the battle in time");
				}),
			])) as [EngineEnd, EngineEnd];

			// Both engines surface the admin-driven end (what the hook consumes).
			expect(endP1).toEqual({ outcome: "win", reason: "admin" });
			expect(endP2).toEqual({ outcome: "loss", reason: "admin" });

			ca.engine.destroy();
			cb.engine.destroy();
			admin.close();
			a.client.close();
			b.client.close();
		},
		60_000,
	);
});
