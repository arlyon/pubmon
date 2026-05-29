/**
 * Tournament E2E — uneven bracket (7 players) with an unresponsive player.
 *
 * Exercises two things the even-bracket happy path doesn't:
 *   1. Byes: 7 players -> next power of 2 is 8 -> exactly one bye for the top
 *      seed; the other six play three real round-1 battles.
 *   2. Removal of an unresponsive player: one player opts in but never joins
 *      its battle room. An admin kicks it (admin_kick_player); the rule is a
 *      walkover — the opponent is released from the waiting battle room,
 *      advances, and the tournament still resolves to a champion among the
 *      responsive players.
 *
 * "ACE" is given extra fights so it is the guaranteed top seed (and therefore
 * gets the bye), which keeps the unresponsive player ("GHOST") in a real,
 * kickable match.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
	ADMIN_SECRET,
	adminState,
	connectMain,
	createAndSetup,
	findMatchForSession,
	runPlayerAgent,
	startWrangler,
	stopWrangler,
	type E2EPlayer,
	type WranglerHandle,
} from "./e2e-harness";

const PORT = 8792; // distinct from the 4-player test's port

let wrangler: WranglerHandle;

beforeAll(async () => {
	wrangler = await startWrangler(PORT);
}, 40_000);

afterAll(() => stopWrangler(wrangler));

/** Log `count` winning fights for a player to inflate its seed. */
async function padSeed(player: E2EPlayer, count: number) {
	for (let i = 0; i < count; i++) {
		player.client.send({
			type: "fight",
			sessionId: player.sessionId,
			pubmonId: 10,
			battleStartTime: Date.now(),
			battleEndTime: Date.now(),
			outcome: "win",
		});
		await player.client.waitFor("fight_result");
	}
}

describe("Tournament E2E — 7 players, bye + unresponsive removal", () => {
	test(
		"uneven bracket resolves to a champion after kicking a no-show",
		async () => {
			// ── Seven players join (ACE first so it can be seeded for the bye) ─
			const ace = await createAndSetup(PORT, "ACE", 1);
			const bree = await createAndSetup(PORT, "BREE", 2);
			const cade = await createAndSetup(PORT, "CADE", 3);
			const drew = await createAndSetup(PORT, "DREW", 4);
			const elle = await createAndSetup(PORT, "ELLE", 5);
			const finn = await createAndSetup(PORT, "FINN", 1);
			const ghost = await createAndSetup(PORT, "GHOST", 2);

			const all = [ace, bree, cade, drew, elle, finn, ghost];

			// ACE becomes the clear top seed -> guaranteed bye -> GHOST stays in a
			// real (kickable) match.
			await padSeed(ace, 2);

			for (const p of all) {
				p.client.send({
					type: "opt_in_tournament",
					sessionId: p.sessionId,
					optIn: true,
				});
			}
			for (const p of all) await p.client.waitFor("player_state");

			// ── Admin starts the tournament ──────────────────────────────────
			const admin = await connectMain(PORT);
			admin.send({ type: "admin_start_tournament", adminSecret: ADMIN_SECRET });

			const r1 = await admin.waitFor("tournament_start", 8000);
			expect(r1.bracket.round).toBe(1);
			// 8-slot bracket: 1 bye + 3 real matches = 4 matches.
			expect(r1.bracket.matches).toHaveLength(4);

			const byeMatches = r1.bracket.matches.filter(
				(m) => m.player2SessionId === null,
			);
			expect(byeMatches).toHaveLength(1);
			expect(byeMatches[0].status).toBe("completed");
			expect(byeMatches[0].winnerId).toBe(ace.sessionId); // top seed got the bye

			const pending = r1.bracket.matches.filter((m) => m.status === "pending");
			expect(pending).toHaveLength(3);

			// GHOST must be in a real match (not the bye).
			const ghostMatch = findMatchForSession(r1.bracket, ghost.sessionId)!;
			expect(ghostMatch).toBeDefined();
			expect(ghostMatch.player2SessionId).not.toBeNull();

			// ── Admin kicks the unresponsive player after a short grace ───────
			// GHOST never runs an agent / never joins its battle; its opponent is
			// left waiting in the room until the kick releases it.
			const adminTask = (async () => {
				await Bun.sleep(3000);
				admin.send({
					type: "admin_kick_player",
					adminSecret: ADMIN_SECRET,
					matchId: ghostMatch.matchId,
					sessionId: ghost.sessionId,
				});
			})();

			// Everyone except GHOST plays autonomously.
			const responsive = all.filter((p) => p.sessionId !== ghost.sessionId);
			const responsiveIds = new Set(responsive.map((p) => p.sessionId));
			const [agentResults] = await Promise.all([
				Promise.all(responsive.map((p) => runPlayerAgent(PORT, p))),
				adminTask,
			]);

			// GHOST's opponent was released by the kick and won by walkover.
			const ghostOpponentId =
				ghostMatch.player1SessionId === ghost.sessionId
					? ghostMatch.player2SessionId!
					: ghostMatch.player1SessionId;
			const opponentResults =
				agentResults[responsive.findIndex((p) => p.sessionId === ghostOpponentId)];
			expect(
				opponentResults.some((r) => r.winnerId === ghostOpponentId),
			).toBe(true);

			// Every reported winner is a responsive player (GHOST never wins).
			for (const r of agentResults.flat()) {
				if (r.winnerId) expect(responsiveIds.has(r.winnerId)).toBe(true);
			}

			// ── Post-tournament state: champion crowned, 3 rounds deep ────────
			let state: any;
			const deadline = Date.now() + 10_000;
			while (Date.now() < deadline) {
				state = await adminState(admin);
				if (state.tournamentBracket?.champion) break;
				await Bun.sleep(200);
			}

			const bracket = state.tournamentBracket;
			expect(bracket.round).toBe(3); // 7 players -> R1 (4 winners) -> R2 -> final
			expect(bracket.matches).toHaveLength(1);
			expect(bracket.matches[0].status).toBe("completed");
			expect(bracket.champion).toBeDefined();
			expect(bracket.champion).not.toBe(ghost.sessionId);
			expect(responsiveIds.has(bracket.champion)).toBe(true);

			// GHOST's round-1 match was recorded as a forfeit walkover.
			const finalState = state;
			expect(finalState.players[ghost.sessionId]).toBeDefined();

			for (const p of all) p.client.close();
			admin.close();
		},
		120_000,
	);
});
