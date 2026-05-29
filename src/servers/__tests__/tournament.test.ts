import { describe, test, expect, beforeEach } from "bun:test";
import type { ServerMessage } from "../../types/messages";
import {
	createServer,
	createPlayer,
	createTournamentPlayers,
	optIn,
	logFight,
	send,
	connect,
	completeBattle,
	adminStartTournament,
	adminRequestState,
	getLiveBracket,
	matchStarts,
	MockConnection,
	ADMIN_SECRET,
	latestBracket,
	type TestServer,
} from "./harness";

describe("Tournament — opt-in & start requirements", () => {
	let s: TestServer;

	beforeEach(async () => {
		s = await createServer();
	});

	test("player can opt in and out", async () => {
		const alice = await createPlayer(s.server, "ALICE");

		await optIn(s.server, alice);
		expect(alice.conn.latest("player_state")!.playerState.tournamentOptIn).toBe(
			true,
		);

		await optIn(s.server, alice, false);
		expect(alice.conn.latest("player_state")!.playerState.tournamentOptIn).toBe(
			false,
		);
	});

	test("tournament requires ≥2 opted-in players", async () => {
		const alice = await createPlayer(s.server, "ALICE");
		await optIn(s.server, alice);

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		expect(s.broadcasts.filter((m) => m.type === "tournament_start")).toHaveLength(0);
	});

	test("non-opted-in players are excluded", async () => {
		const [alice, bob, carol] = await Promise.all([
			createPlayer(s.server, "ALICE", 1),
			createPlayer(s.server, "BOB", 2),
			createPlayer(s.server, "CAROL", 3),
		]);
		await optIn(s.server, alice);
		await optIn(s.server, bob);
		// Carol does NOT opt in

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const bracket = latestBracket(s.broadcasts)!;
		const allIds = bracket.bracket.matches.flatMap((m) =>
			[m.player1SessionId, m.player2SessionId].filter(Boolean),
		);
		expect(allIds).not.toContain(carol.sessionId);
	});

	test("starting tournament sets phase to 'tournament'", async () => {
		await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const state = await adminRequestState(s.server, admin);
		expect(state.state.phase).toBe("tournament");
	});
});

describe("Tournament — bracket structure & seeding", () => {
	let s: TestServer;

	beforeEach(async () => {
		s = await createServer();
	});

	test("2 players → 1 match, no byes", async () => {
		await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const b = latestBracket(s.broadcasts)!;
		expect(b.bracket.matches).toHaveLength(1);
		expect(b.bracket.matches[0].player2SessionId).not.toBeNull();
	});

	test("3 players → 1 bye + 1 real match", async () => {
		const players = await createTournamentPlayers(s.server, 3);

		// Give first player more battles so they seed highest (gets bye)
		await logFight(s.server, players[0]);

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Use live bracket (has status updated by startRoundMatches)
		const bracket = await getLiveBracket(s.server, admin);
		const byes = bracket.matches.filter(
			(m: any) => m.player2SessionId === null,
		);
		const real = bracket.matches.filter(
			(m: any) => m.player2SessionId !== null,
		);

		expect(byes).toHaveLength(1);
		expect(byes[0].status).toBe("completed");
		expect(byes[0].winnerId).toBe(byes[0].player1SessionId);
		expect(real).toHaveLength(1);
		expect(real[0].status).toBe("in_progress");
	});

	test("4 players → 2 matches, no byes", async () => {
		await createTournamentPlayers(s.server, 4);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const b = latestBracket(s.broadcasts)!;
		expect(b.bracket.matches).toHaveLength(2);
		expect(b.bracket.matches.every((m) => m.player2SessionId !== null)).toBe(true);
	});

	test("5 players → 3 byes + 1 real match", async () => {
		await createTournamentPlayers(s.server, 5);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const b = latestBracket(s.broadcasts)!;
		const byes = b.bracket.matches.filter((m) => m.player2SessionId === null);
		const real = b.bracket.matches.filter((m) => m.player2SessionId !== null);
		expect(byes).toHaveLength(3);
		expect(real).toHaveLength(1);
	});

	test("8 players → 4 matches, no byes", async () => {
		await createTournamentPlayers(s.server, 8);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const b = latestBracket(s.broadcasts)!;
		expect(b.bracket.matches).toHaveLength(4);
		expect(b.bracket.matches.every((m) => m.player2SessionId !== null)).toBe(true);
	});

	test("top-seeded player (most battles) gets the bye", async () => {
		const players = await createTournamentPlayers(s.server, 3);

		// Give player[0] 3 extra fights so they have the most battleLog entries
		for (let i = 0; i < 3; i++) await logFight(s.server, players[0]);

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const b = latestBracket(s.broadcasts)!;
		const byeMatch = b.bracket.matches.find((m) => m.player2SessionId === null)!;
		expect(byeMatch.player1SessionId).toBe(players[0].sessionId);
	});
});

describe("Tournament — battle completion & round advancement", () => {
	let s: TestServer;

	beforeEach(async () => {
		s = await createServer();
	});

	test("completing a battle marks match as completed", async () => {
		const players = await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Get battleId from match_start broadcast
		const ms = matchStarts(s.broadcasts);
		expect(ms).toHaveLength(1);

		await completeBattle(s.server, ms[0].battleId, players[0].sessionId);

		const complete = s.broadcasts.find(
			(m) => m.type === "match_complete",
		) as Extract<ServerMessage, { type: "match_complete" }>;
		expect(complete).toBeDefined();
		expect(complete.winnerId).toBe(players[0].sessionId);
	});

	test("match_start broadcast has correct player info", async () => {
		const players = await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const ms = matchStarts(s.broadcasts);
		expect(ms).toHaveLength(1);
		expect(ms[0].battleId).toBeTruthy();
		expect([ms[0].player1Name, ms[0].player2Name].sort()).toEqual(
			[players[0].name, players[1].name].sort(),
		);
	});

	test("activeBattleId set on match start, cleared on completion", async () => {
		const players = await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Check active battle is set
		let state = await adminRequestState(s.server, admin);
		const p1 = state.state.players[players[0].sessionId];
		const p2 = state.state.players[players[1].sessionId];
		expect(p1.activeBattleId).toBeTruthy();
		expect(p2.activeBattleId).toBeTruthy();
		expect(p1.activeBattleId).toBe(p2.activeBattleId);

		// Complete battle via match_start battleId
		const ms = matchStarts(s.broadcasts);
		await completeBattle(s.server, ms[0].battleId, players[0].sessionId);

		// Check active battle is cleared
		state = await adminRequestState(s.server, admin);
		expect(
			state.state.players[players[0].sessionId].activeBattleId,
		).toBeUndefined();
		expect(
			state.state.players[players[1].sessionId].activeBattleId,
		).toBeUndefined();
	});

	test("4-player tournament: 2 rounds to a winner", async () => {
		const players = await createTournamentPlayers(s.server, 4);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Round 1: get battleIds from match_start broadcasts
		const r1 = latestBracket(s.broadcasts, 1)!;
		expect(r1.bracket.matches).toHaveLength(2);

		let ms = matchStarts(s.broadcasts);
		expect(ms).toHaveLength(2);

		// Complete round 1 — first player in each match wins
		for (const m of ms) {
			await completeBattle(s.server, m.battleId, m.player1SessionId);
		}

		// Round 2 should exist
		const r2 = latestBracket(s.broadcasts, 2)!;
		expect(r2).toBeDefined();
		expect(r2.bracket.matches).toHaveLength(1);

		// Round 2 match_start
		const allMs = matchStarts(s.broadcasts);
		const r2Ms = allMs.slice(2); // skip round 1's match_starts
		expect(r2Ms).toHaveLength(1);

		await completeBattle(s.server, r2Ms[0].battleId, r2Ms[0].player1SessionId);

		// No round 3
		expect(latestBracket(s.broadcasts, 3)).toBeUndefined();
	});

	test("8-player tournament: 3 rounds to a winner", async () => {
		const players = await createTournamentPlayers(s.server, 8);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Round 1: 4 matches
		expect(latestBracket(s.broadcasts, 1)!.bracket.matches).toHaveLength(4);
		let ms = matchStarts(s.broadcasts);
		expect(ms).toHaveLength(4);
		for (const m of ms) {
			await completeBattle(s.server, m.battleId, m.player1SessionId);
		}

		// Round 2: 2 matches
		expect(latestBracket(s.broadcasts, 2)!.bracket.matches).toHaveLength(2);
		const allMs = matchStarts(s.broadcasts);
		const r2Ms = allMs.slice(4);
		expect(r2Ms).toHaveLength(2);
		for (const m of r2Ms) {
			await completeBattle(s.server, m.battleId, m.player1SessionId);
		}

		// Round 3: final
		expect(latestBracket(s.broadcasts, 3)!.bracket.matches).toHaveLength(1);
		const r3Ms = matchStarts(s.broadcasts).slice(6);
		expect(r3Ms).toHaveLength(1);
		await completeBattle(s.server, r3Ms[0].battleId, r3Ms[0].player1SessionId);

		expect(latestBracket(s.broadcasts, 4)).toBeUndefined();
	});

	test("3-player tournament: bye player meets round-1 winner in final", async () => {
		const players = await createTournamentPlayers(s.server, 3);
		// Give first player extra fights for highest seed → bye
		for (let i = 0; i < 3; i++) await logFight(s.server, players[0]);

		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const bracket = await getLiveBracket(s.server, admin);
		const byeMatch = bracket.matches.find(
			(m: any) => m.player2SessionId === null,
		)!;
		const realMatch = bracket.matches.find(
			(m: any) => m.player2SessionId !== null,
		)!;

		expect(byeMatch.status).toBe("completed");
		expect(realMatch.status).toBe("in_progress");

		// Complete real match
		await completeBattle(
			s.server,
			realMatch.battleId,
			realMatch.player1SessionId,
		);

		// Round 2
		const r2 = latestBracket(s.broadcasts, 2)!;
		expect(r2.bracket.matches).toHaveLength(1);
		const finalists = [
			r2.bracket.matches[0].player1SessionId,
			r2.bracket.matches[0].player2SessionId,
		];
		expect(finalists).toContain(byeMatch.winnerId);
		expect(finalists).toContain(realMatch.player1SessionId);
	});
});

describe("Tournament — admin controls", () => {
	let s: TestServer;

	beforeEach(async () => {
		s = await createServer();
	});

	test("admin promote force-advances a player", async () => {
		const players = await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const bracket = await getLiveBracket(s.server, admin);
		const match = bracket.matches[0];

		await send(s.server, admin, {
			type: "admin_promote_player",
			adminSecret: ADMIN_SECRET,
			matchId: match.matchId,
			sessionId: players[0].sessionId,
		});

		const update = s.broadcasts.find(
			(m) => m.type === "bracket_update",
		) as Extract<ServerMessage, { type: "bracket_update" }>;
		const updated = update.bracket.matches.find(
			(m) => m.matchId === match.matchId,
		)!;
		expect(updated.winnerId).toBe(players[0].sessionId);
		expect(updated.status).toBe("completed");
		expect(updated.adminOverride).toBe(true);
	});

	test("admin kick advances the opponent", async () => {
		const players = await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const bracket = await getLiveBracket(s.server, admin);
		const match = bracket.matches[0];

		await send(s.server, admin, {
			type: "admin_kick_player",
			adminSecret: ADMIN_SECRET,
			matchId: match.matchId,
			sessionId: players[0].sessionId,
		});

		const update = s.broadcasts.find(
			(m) => m.type === "bracket_update",
		) as Extract<ServerMessage, { type: "bracket_update" }>;
		const updated = update.bracket.matches.find(
			(m) => m.matchId === match.matchId,
		)!;
		expect(updated.winnerId).toBe(players[1].sessionId);
		expect(updated.status).toBe("forfeited");
	});

	test("admin forfeit advances the other player", async () => {
		const players = await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		// Get battleId from match_start (forfeit uses battleId, not matchId)
		const ms = matchStarts(s.broadcasts);
		const battleId = ms[0].battleId;

		await send(s.server, admin, {
			type: "admin_forfeit_match",
			adminSecret: ADMIN_SECRET,
			battleId,
			forfeitSessionId: players[0].sessionId,
		});

		const complete = s.broadcasts.find(
			(m) => m.type === "match_complete",
		) as Extract<ServerMessage, { type: "match_complete" }>;
		expect(complete.winnerId).toBe(players[1].sessionId);
	});

	test("wrong admin secret is rejected", async () => {
		const conn = new MockConnection("bad");
		await connect(s.server, conn);

		await send(s.server, conn, {
			type: "admin_start_tournament",
			adminSecret: "wrong",
		});

		const err = conn.latest("error");
		expect(err).toBeDefined();
		expect(err!.message).toContain("admin");
	});
});

describe("Tournament — state persistence", () => {
	test("tournament state survives a server restart", async () => {
		const s1 = await createServer();
		await createTournamentPlayers(s1.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s1.server, admin);

		// Restart with same storage
		const s2 = await createServer(s1.storage);

		const admin2 = new MockConnection("admin2");
		const state = await adminRequestState(s2.server, admin2);
		expect(state.state.phase).toBe("tournament");
		expect(state.state.tournamentBracket).toBeDefined();
		expect(state.state.tournamentBracket.round).toBe(1);
		expect(Object.keys(state.state.players)).toHaveLength(2);
	});

	test("late-joining connection receives current bracket", async () => {
		const s = await createServer();
		await createTournamentPlayers(s.server, 2);
		const admin = new MockConnection("admin");
		await adminStartTournament(s.server, admin);

		const latecomer = new MockConnection("late");
		await connect(s.server, latecomer);

		const t = latecomer.latest("tournament_start");
		expect(t).toBeDefined();
		expect(t!.bracket.round).toBe(1);
	});
});
