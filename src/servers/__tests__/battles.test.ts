import { describe, test, expect, beforeEach } from "bun:test";
import type { MainEventServer } from "../MainEventServer";
import type { ServerMessage } from "../../types/messages";
import {
	createServer,
	createPlayer,
	send,
	connect,
	MockConnection,
	ADMIN_SECRET,
	type TestPlayer,
	type TestServer,
} from "./harness";

describe("Battles — player creation & collection phase", () => {
	let s: TestServer;

	beforeEach(async () => {
		s = await createServer();
	});

	// ── Player creation ─────────────────────────────────────────────────────

	test("create player and receive player_created", async () => {
		const conn = new MockConnection("s1");
		await connect(s.server, conn);

		await send(s.server, conn, {
			type: "create_player",
			sessionId: "s1",
			playerInfo: { name: "ALICE", sprite: "boy" },
		});

		const created = conn.latest("player_created");
		expect(created).toBeDefined();
		expect(created!.sessionId).toBe("s1");
	});

	test("duplicate name is rejected", async () => {
		await createPlayer(s.server, "ALICE");

		const conn2 = new MockConnection("s2");
		await connect(s.server, conn2);
		await send(s.server, conn2, {
			type: "create_player",
			sessionId: "s2",
			playerInfo: { name: "ALICE", sprite: "girl" },
		});

		const err = conn2.latest("error");
		expect(err).toBeDefined();
		expect(err!.message).toContain("Name already taken");
	});

	test("check_name returns available for unused name", async () => {
		const conn = new MockConnection("c1");
		await connect(s.server, conn);

		await send(s.server, conn, { type: "check_name", name: "NEWNAME" });

		const status = conn.latest("name_status");
		expect(status).toBeDefined();
		expect(status!.available).toBe(true);
	});

	test("check_name returns unavailable for taken name", async () => {
		await createPlayer(s.server, "ALICE");

		const conn = new MockConnection("c1");
		await connect(s.server, conn);
		await send(s.server, conn, { type: "check_name", name: "alice" });

		const status = conn.latest("name_status");
		expect(status!.available).toBe(false);
	});

	// ── Starter selection ───────────────────────────────────────────────────

	test("select starter adds PubMon to party", async () => {
		const alice = await createPlayer(s.server, "ALICE", 1);

		const state = alice.conn.latest("player_state");
		expect(state).toBeDefined();
		expect(state!.playerState.party).toHaveLength(1);
		expect(state!.playerState.party[0].name).toBe("Hoppsin");
	});

	// ── Drink ordering ──────────────────────────────────────────────────────

	test("ordering a drink triggers an encounter", async () => {
		const alice = await createPlayer(s.server, "ALICE");

		await send(s.server, alice.conn, {
			type: "order_drink",
			sessionId: alice.sessionId,
			drinkType: "beer",
		});

		const encounter = alice.conn.latest("encounter_result");
		expect(encounter).toBeDefined();
		expect(encounter!.wildPubmon).toBeDefined();
		expect(encounter!.wildPubmon.id).toBeGreaterThan(0);
	});

	// ── Fighting ────────────────────────────────────────────────────────────

	test("fight logs battle, awards XP, and returns fight_result", async () => {
		const alice = await createPlayer(s.server, "ALICE", 1);

		await send(s.server, alice.conn, {
			type: "fight",
			sessionId: alice.sessionId,
			pubmonId: 10,
			battleStartTime: Date.now(),
			battleEndTime: Date.now(),
			outcome: "win",
		});

		const result = alice.conn.latest("fight_result");
		expect(result).toBeDefined();
		expect(result!.xpGained).toBeGreaterThan(0);

		// Battle log updated
		const state = alice.conn.latest("player_state");
		expect(state!.playerState.battleLog.length).toBeGreaterThanOrEqual(1);
	});

	test("first fight at current gym awards a badge", async () => {
		const alice = await createPlayer(s.server, "ALICE", 1);

		await send(s.server, alice.conn, {
			type: "fight",
			sessionId: alice.sessionId,
			pubmonId: 10,
			battleStartTime: Date.now(),
			battleEndTime: Date.now(),
			outcome: "win",
		});

		const result = alice.conn.latest("fight_result");
		expect(result!.awardedBadgeId).toBe(1); // currentGymId defaults to 1
	});

	test("second fight at same gym does not award another badge", async () => {
		const alice = await createPlayer(s.server, "ALICE", 1);

		for (let i = 0; i < 2; i++) {
			await send(s.server, alice.conn, {
				type: "fight",
				sessionId: alice.sessionId,
				pubmonId: 10,
				battleStartTime: Date.now(),
				battleEndTime: Date.now(),
				outcome: "win",
			});
		}

		const results = alice.conn.ofType("fight_result");
		expect(results[0].awardedBadgeId).toBe(1);
		expect(results[1].awardedBadgeId).toBeUndefined();
	});

	// ── Running ─────────────────────────────────────────────────────────────

	test("run logs battle outcome in player state", async () => {
		const alice = await createPlayer(s.server, "ALICE", 1);

		await send(s.server, alice.conn, {
			type: "run",
			sessionId: alice.sessionId,
			pubmonId: 10,
			battleStartTime: Date.now(),
			battleEndTime: Date.now(),
		});

		const state = alice.conn.latest("player_state");
		const runEntries = state!.playerState.battleLog.filter(
			(e: any) => e.outcome === "run",
		);
		expect(runEntries).toHaveLength(1);
	});

	// ── Session validation ──────────────────────────────────────────────────

	test("messages with unknown sessionId are rejected", async () => {
		const conn = new MockConnection("unknown");
		await connect(s.server, conn);

		await send(s.server, conn, {
			type: "order_drink",
			sessionId: "nonexistent",
			drinkType: "beer",
		});

		const err = conn.latest("error");
		expect(err).toBeDefined();
		expect(err!.message).toContain("Invalid session");
	});

	// ── Set active mon ──────────────────────────────────────────────────────

	test("set_active_mon rejects out-of-range index", async () => {
		const alice = await createPlayer(s.server, "ALICE", 1);

		await send(s.server, alice.conn, {
			type: "set_active_mon",
			sessionId: alice.sessionId,
			activeIndex: 99,
		});

		const err = alice.conn.latest("error");
		expect(err).toBeDefined();
		expect(err!.message).toContain("Invalid active index");
	});

	// ── Leaderboard ─────────────────────────────────────────────────────────

	test("new connection receives leaderboard with existing players", async () => {
		await createPlayer(s.server, "ALICE", 1);
		await createPlayer(s.server, "BOB", 2);

		const latecomer = new MockConnection("late");
		await connect(s.server, latecomer);

		const lb = latecomer.latest("leaderboard_sync");
		expect(lb).toBeDefined();
		expect(lb!.players).toHaveLength(2);
	});

	// ── Admin gym control ───────────────────────────────────────────────────

	test("admin can change the current gym", async () => {
		const admin = new MockConnection("admin");
		await connect(s.server, admin);

		await send(s.server, admin, {
			type: "admin_set_gym",
			adminSecret: ADMIN_SECRET,
			gymId: 5,
		});

		const gymUpdate = s.broadcasts.find(
			(m) => m.type === "gym_update",
		) as Extract<ServerMessage, { type: "gym_update" }>;
		expect(gymUpdate).toBeDefined();
		expect(gymUpdate.currentGymId).toBe(5);
	});
});
