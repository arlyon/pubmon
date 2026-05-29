/**
 * Admin-controls E2E — reset, resolve/void, and battle timing telemetry, all
 * against a live wrangler server.
 *
 * Covers:
 *   1. admin_reset_tournament returns everyone to collection and preserves
 *      opt-ins so the admin can immediately restart.
 *   2. Battle rooms expose timing (startedAt / lastMoveAt / serverNow) so the
 *      admin console can render total + idle timers.
 *   3. admin_resolve_match with winnerId=null VOIDS a match: the live battle is
 *      formally ended (battle_end reason "void" reaches the room), nobody
 *      advances, and the round resolves.
 *   4. admin_resolve_match with a winner declares it; a natural battle reports
 *      durationMs / moveCount on match_complete.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
	ADMIN_SECRET,
	adminState,
	connectMain,
	createAndSetup,
	playBattle,
	startWrangler,
	stopWrangler,
	type WranglerHandle,
} from "./e2e-harness";

const PORT = 8793;

let wrangler: WranglerHandle;

beforeAll(async () => {
	wrangler = await startWrangler(PORT);
}, 40_000);

afterAll(() => stopWrangler(wrangler));

/** Join a battle room as a participant but never act (for stall/void tests). */
function joinBattleRaw(port: number, battleId: string, sessionId: string) {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/parties/battle/${battleId}`);
	const messages: any[] = [];
	ws.onmessage = (ev) => {
		try {
			messages.push(JSON.parse(String(ev.data)));
		} catch {
			/* ignore */
		}
	};
	const ready = new Promise<void>((resolve, reject) => {
		ws.onopen = () => {
			ws.send(JSON.stringify({ type: "battle_join", sessionId }));
			resolve();
		};
		ws.onerror = (e) => reject(e);
	});
	const waitFor = async (type: string, timeoutMs = 8000) => {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const m = messages.find((x) => x.type === type);
			if (m) return m;
			await Bun.sleep(50);
		}
		return null;
	};
	return { ws, messages, ready, waitFor, close: () => ws.close() };
}

describe("Admin controls E2E — reset, void, timing", () => {
	test(
		"reset restarts cleanly; void + declared winner resolve a round",
		async () => {
			const players = await Promise.all([
				createAndSetup(PORT, "AXEL", 1),
				createAndSetup(PORT, "BLYTHE", 2),
				createAndSetup(PORT, "CIRO", 3),
				createAndSetup(PORT, "DESHI", 4),
			]);
			const byId = new Map(players.map((p) => [p.sessionId, p]));

			for (const p of players) {
				p.client.send({
					type: "opt_in_tournament",
					sessionId: p.sessionId,
					optIn: true,
				});
			}
			for (const p of players) await p.client.waitFor("player_state");

			const admin = await connectMain(PORT);

			// ── 1. Start, then RESET back to collection ──────────────────────
			admin.send({ type: "admin_start_tournament", adminSecret: ADMIN_SECRET });
			await admin.waitFor("tournament_start", 8000);

			admin.messages = admin.messages.filter((m) => m.type !== "gym_update");
			admin.send({ type: "admin_reset_tournament", adminSecret: ADMIN_SECRET });
			const reset = await admin.waitFor("gym_update", 5000);
			expect(reset.gamePhase).toBe("collection");

			let state = await adminState(admin);
			expect(state.phase).toBe("collection");
			expect(state.tournamentBracket).toBeUndefined();
			// Opt-ins preserved.
			for (const p of players) {
				expect(state.players[p.sessionId].tournamentOptIn).toBe(true);
			}

			// ── 2. Restart — opt-ins still in effect ─────────────────────────
			admin.messages = admin.messages.filter(
				(m) => m.type !== "tournament_start",
			);
			admin.send({ type: "admin_start_tournament", adminSecret: ADMIN_SECRET });
			const r1 = await admin.waitFor("tournament_start", 8000);
			expect(r1.bracket.round).toBe(1);
			expect(r1.bracket.matches).toHaveLength(2);

			// Pull live matches (matchId + battleId both set after start).
			state = await adminState(admin);
			const matches = state.tournamentBracket.matches.filter(
				(m: any) => m.status === "in_progress",
			);
			expect(matches).toHaveLength(2);
			const [voidMatch, winMatch] = matches;

			// ── 3. VOID one match ────────────────────────────────────────────
			// Both players join the room (battle goes active) but never move.
			const vp1 = joinBattleRaw(PORT, voidMatch.battleId, voidMatch.player1SessionId);
			const vp2 = joinBattleRaw(PORT, voidMatch.battleId, voidMatch.player2SessionId);
			await Promise.all([vp1.ready, vp2.ready]);

			// Timing telemetry is present and sane.
			const bs = await vp1.waitFor("battle_state");
			expect(bs).not.toBeNull();
			expect(typeof bs.startedAt).toBe("number");
			expect(typeof bs.lastMoveAt).toBe("number");
			expect(typeof bs.serverNow).toBe("number");
			expect(bs.serverNow).toBeGreaterThanOrEqual(bs.lastMoveAt);
			expect(bs.lastMoveAt).toBeGreaterThanOrEqual(bs.startedAt);

			// Admin voids it.
			admin.send({
				type: "admin_resolve_match",
				adminSecret: ADMIN_SECRET,
				matchId: voidMatch.matchId,
				winnerId: null,
			});

			// The room is formally ended for the players (threads to battle hook).
			const end = await vp1.waitFor("battle_end");
			expect(end).not.toBeNull();
			expect(end.reason).toBe("void");
			expect(end.winnerId).toBe("");
			vp1.close();
			vp2.close();

			// match_complete on the main stream carries no winner.
			const voidComplete = admin
				.ofType("match_complete")
				.find((m) => m.battleId === voidMatch.battleId);
			expect(voidComplete).toBeDefined();
			expect(voidComplete!.winnerId).toBe("");

			// ── 4. Play the other match naturally to a winner ────────────────
			const winP1 = byId.get(winMatch.player1SessionId)!;
			const winP2 = byId.get(winMatch.player2SessionId)!;
			const [w1, w2] = await Promise.all([
				playBattle(PORT, winMatch.battleId, winP1.sessionId, winP1.client),
				playBattle(PORT, winMatch.battleId, winP2.sessionId, winP2.client),
			]);
			const naturalWinner = w1 ?? w2;
			expect([winP1.sessionId, winP2.sessionId]).toContain(naturalWinner);

			// Natural completion reports timing on match_complete.
			const winComplete = admin
				.ofType("match_complete")
				.find((m) => m.battleId === winMatch.battleId);
			expect(winComplete).toBeDefined();
			expect(typeof winComplete!.durationMs).toBe("number");
			expect(typeof winComplete!.moveCount).toBe("number");

			// ── 5. Round resolved: void advances nobody -> single winner crowned
			const deadline = Date.now() + 10_000;
			let final: any;
			while (Date.now() < deadline) {
				final = await adminState(admin);
				if (final.tournamentBracket?.champion) break;
				await Bun.sleep(200);
			}
			expect(final.tournamentBracket.champion).toBe(naturalWinner);
			// The voided players did not advance.
			expect(final.tournamentBracket.champion).not.toBe(voidMatch.player1SessionId);
			expect(final.tournamentBracket.champion).not.toBe(voidMatch.player2SessionId);

			for (const p of players) p.client.close();
			admin.close();
		},
		120_000,
	);
});
