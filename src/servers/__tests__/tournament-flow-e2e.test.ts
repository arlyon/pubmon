/**
 * Full tournament E2E — 4 real WebSocket clients play a complete bracket
 * against a live wrangler dev server, driving REAL @pkmn/sim battles in the
 * BattleServer durable objects.
 *
 * Flow under test:
 *   1. MainEventServer (DO) starts.
 *   2. 4 players join, create accounts, pick starters.
 *   3. All 4 opt into the tournament.
 *   4. Admin starts the tournament -> round 1 bracket (2 matches).
 *   5. Battle rooms are created; each pair plays a real battle to a |win|.
 *   6. BattleServer reports each result back to the MainEventServer (RPC).
 *   7. The 2 winners advance and play the final.
 *   8. The final winner is reported; the bracket records a champion
 *      (post-tournament state).
 *
 * Unlike the harness tests, NOTHING here short-circuits the battle: results
 * only reach the MainEventServer if the BattleServer<->MainEventServer RPC
 * actually works end to end.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
	ADMIN_SECRET,
	adminState,
	connectMain,
	createAndSetup,
	runPlayerAgent,
	startWrangler,
	stopWrangler,
	type WranglerHandle,
} from "./e2e-harness";

const PORT = 8791;

let wrangler: WranglerHandle;

beforeAll(async () => {
	wrangler = await startWrangler(PORT);
}, 40_000);

afterAll(() => stopWrangler(wrangler));

describe("Tournament E2E — 4 clients, real battles", () => {
	test(
		"4 players play a full bracket to a champion",
		async () => {
			// ── 1-2. Four players join, set up, opt in ───────────────────────
			const players = await Promise.all([
				createAndSetup(PORT, "ALPHA", 1),
				createAndSetup(PORT, "BRAVO", 2),
				createAndSetup(PORT, "CHARLIE", 3),
				createAndSetup(PORT, "DELTA", 4),
			]);
			const sessionIds = new Set(players.map((p) => p.sessionId));

			for (const p of players) {
				p.client.send({
					type: "opt_in_tournament",
					sessionId: p.sessionId,
					optIn: true,
				});
			}
			for (const p of players) await p.client.waitFor("player_state");

			// ── 3. Admin starts the tournament ───────────────────────────────
			const admin = await connectMain(PORT);
			admin.send({ type: "admin_start_tournament", adminSecret: ADMIN_SECRET });

			// Round 1: 2 matches (4 players, power of 2, no byes).
			const r1 = await players[0].client.waitFor("tournament_start", 8000);
			expect(r1.bracket.round).toBe(1);
			expect(r1.bracket.matches).toHaveLength(2);

			// ── 4-7. Everyone plays autonomously until eliminated / champion ──
			const allResults = await Promise.all(
				players.map((p) => runPlayerAgent(PORT, p)),
			);

			const matchesPlayed = allResults.flat();
			const uniqueBattleIds = new Set(matchesPlayed.map((r) => r.battleId));
			// 2 round-1 battles + 1 final = 3 distinct battles.
			expect(uniqueBattleIds.size).toBe(3);
			for (const r of matchesPlayed) {
				expect(sessionIds.has(r.winnerId!)).toBe(true);
			}

			// ── 8. Post-tournament state: a champion is recorded ─────────────
			let state: any;
			const deadline = Date.now() + 10_000;
			while (Date.now() < deadline) {
				state = await adminState(admin);
				if (state.tournamentBracket?.champion) break;
				await Bun.sleep(200);
			}

			const bracket = state.tournamentBracket;
			expect(bracket).toBeDefined();
			expect(bracket.round).toBe(2); // final round
			expect(bracket.matches).toHaveLength(1);

			const finalMatch = bracket.matches[0];
			expect(finalMatch.status).toBe("completed");
			expect(sessionIds.has(finalMatch.winnerId)).toBe(true);
			expect(bracket.champion).toBe(finalMatch.winnerId);

			for (const p of players) p.client.close();
			admin.close();
		},
		120_000,
	);
});
