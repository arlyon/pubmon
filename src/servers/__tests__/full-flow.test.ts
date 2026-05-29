import { describe, test, expect } from "bun:test";
import type { ServerMessage } from "../../types/messages";
import {
	createServer,
	createPlayer,
	optIn,
	logFight,
	send,
	connect,
	completeBattle,
	adminStartTournament,
	adminRequestState,
	matchStarts,
	MockConnection,
	ADMIN_SECRET,
	latestBracket,
} from "./harness";

describe("Full flow — player creation through hall of fame", () => {
	test("complete lifecycle: create → collect → tournament → hall of fame", async () => {
		const s = await createServer();

		// ── Phase 1: Player creation ────────────────────────────────────────
		const alice = await createPlayer(s.server, "ALICE", 1);
		const bob = await createPlayer(s.server, "BOB", 2);
		const carol = await createPlayer(s.server, "CAROL", 3);
		const dave = await createPlayer(s.server, "DAVE", 4);

		// Verify all players have starters
		for (const p of [alice, bob, carol, dave]) {
			const state = p.conn.latest("player_state");
			expect(state!.playerState.party).toHaveLength(1);
		}

		// ── Phase 2: Collection — fights & encounters ───────────────────────
		// Alice fights a lot (3 wins + 2 runs)
		for (let i = 0; i < 3; i++) await logFight(s.server, alice);
		for (let i = 0; i < 2; i++) {
			await send(s.server, alice.conn, {
				type: "run",
				sessionId: alice.sessionId,
				pubmonId: 10,
				battleStartTime: Date.now(),
				battleEndTime: Date.now(),
			});
		}

		// Bob fights a bit (1 win)
		await logFight(s.server, bob);

		// Carol catches things (simulate via fight log with 'caught' — we test
		// through the catch_attempt message which has RNG, so we'll give Carol
		// caught entries by calling the fight endpoint and checking state)
		await logFight(s.server, carol);

		// ── Phase 3: Tournament ─────────────────────────────────────────────
		for (const p of [alice, bob, carol, dave]) await optIn(s.server, p);

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Verify phase changed
		let state = await adminRequestState(s.server, admin);
		expect(state.state.phase).toBe("tournament");

		// Round 1: 4 players → 2 matches
		const r1 = latestBracket(s.broadcasts, 1)!;
		expect(r1.bracket.matches).toHaveLength(2);

		// Complete round 1 via match_start battleIds
		let ms = matchStarts(s.broadcasts);
		for (const m of ms) {
			await completeBattle(s.server, m.battleId, m.player1SessionId);
		}

		// Round 2: final
		const r2 = latestBracket(s.broadcasts, 2)!;
		expect(r2.bracket.matches).toHaveLength(1);

		const r2Ms = matchStarts(s.broadcasts).slice(ms.length);
		const championId = r2Ms[0].player1SessionId;
		await completeBattle(s.server, r2Ms[0].battleId, championId);

		// No more rounds
		expect(latestBracket(s.broadcasts, 3)).toBeUndefined();

		// ── Phase 4: Hall of Fame ───────────────────────────────────────────
		await send(s.server, admin, {
			type: "admin_trigger_hall_of_fame",
			adminSecret: ADMIN_SECRET,
		});

		// Phase transitioned
		state = await adminRequestState(s.server, admin);
		expect(state.state.phase).toBe("hall-of-fame");

		// hall_of_fame_ready broadcast was sent
		const hofMsg = s.broadcasts.find((m) => m.type === "hall_of_fame_ready");
		expect(hofMsg).toBeDefined();

		// Champion ribbon awarded
		const championState = state.state.players[championId];
		expect(championState.ribbons).toContain(
			"/sprites/ribbons/champion-ribbon.png",
		);
	});

	test("hall of fame awards stat-based ribbons", async () => {
		const s = await createServer();

		const alice = await createPlayer(s.server, "ALICE", 1);
		const bob = await createPlayer(s.server, "BOB", 2);
		const carol = await createPlayer(s.server, "CAROL", 3);

		// Alice: most wins (expert battler)
		for (let i = 0; i < 5; i++) await logFight(s.server, alice);

		// Bob: most runs (effort ribbon)
		for (let i = 0; i < 4; i++) {
			await send(s.server, bob.conn, {
				type: "run",
				sessionId: bob.sessionId,
				pubmonId: 10,
				battleStartTime: Date.now(),
				battleEndTime: Date.now(),
			});
		}

		// Carol: just one fight for baseline
		await logFight(s.server, carol);

		// Opt in and run minimal tournament
		for (const p of [alice, bob, carol]) await optIn(s.server, p);

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Complete all matches quickly via admin promote
		const r1 = latestBracket(s.broadcasts, 1)!;
		for (const m of r1.bracket.matches) {
			if (m.status === "in_progress") {
				await send(s.server, admin, {
					type: "admin_promote_player",
					adminSecret: ADMIN_SECRET,
					matchId: m.matchId,
					sessionId: m.player1SessionId,
				});
			}
		}

		// Complete round 2 if needed
		const r2 = latestBracket(s.broadcasts, 2);
		if (r2) {
			for (const m of r2.bracket.matches) {
				if (m.status !== "completed") {
					await send(s.server, admin, {
						type: "admin_promote_player",
						adminSecret: ADMIN_SECRET,
						matchId: m.matchId,
						sessionId: m.player1SessionId,
					});
				}
			}
		}

		// Trigger hall of fame
		await send(s.server, admin, {
			type: "admin_trigger_hall_of_fame",
			adminSecret: ADMIN_SECRET,
		});

		const state = await adminRequestState(s.server, admin);

		// Alice should have expert battler ribbon (most wins)
		expect(state.state.players[alice.sessionId].ribbons).toContain(
			"/sprites/ribbons/expert-battler-ribbon.png",
		);

		// Bob should have effort ribbon (most runs)
		expect(state.state.players[bob.sessionId].ribbons).toContain(
			"/sprites/ribbons/effort-ribbon.png",
		);
	});

	test("admin can manually assign a ribbon", async () => {
		const s = await createServer();
		const alice = await createPlayer(s.server, "ALICE", 1);

		const admin = new MockConnection("admin");
		await send(s.server, admin, {
			type: "admin_assign_ribbon",
			adminSecret: ADMIN_SECRET,
			sessionId: alice.sessionId,
			ribbonPath: "/sprites/ribbons/custom.png",
		});

		const state = await adminRequestState(s.server, admin);
		expect(state.state.players[alice.sessionId].ribbons).toContain(
			"/sprites/ribbons/custom.png",
		);
	});

	test("duplicate ribbon assignment is idempotent", async () => {
		const s = await createServer();
		const alice = await createPlayer(s.server, "ALICE", 1);
		const admin = new MockConnection("admin");

		const ribbon = "/sprites/ribbons/custom.png";
		await send(s.server, admin, {
			type: "admin_assign_ribbon",
			adminSecret: ADMIN_SECRET,
			sessionId: alice.sessionId,
			ribbonPath: ribbon,
		});
		await send(s.server, admin, {
			type: "admin_assign_ribbon",
			adminSecret: ADMIN_SECRET,
			sessionId: alice.sessionId,
			ribbonPath: ribbon,
		});

		const state = await adminRequestState(s.server, admin);
		const ribbons = state.state.players[alice.sessionId].ribbons;
		expect(ribbons.filter((r: string) => r === ribbon)).toHaveLength(1);
	});

	test("new connection during hall-of-fame receives hall_of_fame_ready", async () => {
		const s = await createServer();
		const alice = await createPlayer(s.server, "ALICE", 1);
		const bob = await createPlayer(s.server, "BOB", 2);
		await optIn(s.server, alice);
		await optIn(s.server, bob);

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Complete tournament
		const ms = matchStarts(s.broadcasts);
		await completeBattle(s.server, ms[0].battleId, alice.sessionId);

		// Enter hall of fame
		await send(s.server, admin, {
			type: "admin_trigger_hall_of_fame",
			adminSecret: ADMIN_SECRET,
		});

		// New connection arrives
		const latecomer = new MockConnection("latecomer");
		await connect(s.server, latecomer);

		const hof = latecomer.latest("hall_of_fame_ready");
		expect(hof).toBeDefined();
	});
});
