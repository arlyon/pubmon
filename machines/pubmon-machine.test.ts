import { expect, test, describe, beforeEach } from "bun:test";
import { createActor, type AnyActor } from "xstate";
import { pubmonMachine } from "./pubmon-machine";
import type { PubMon } from "@/lib/pokemon-data";

// ============================================================================
// MOCK SOCKET
// ============================================================================

class MockSocket {
  private listeners: Map<string, Set<Function>> = new Map();
  public sentMessages: any[] = [];

  addEventListener(event: string, handler: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler);
  }

  send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }

  simulateMessage(data: any) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.listeners.get("message")?.forEach((handler) => handler(event));
  }
}

// ============================================================================
// TEST HELPERS
// ============================================================================

function makePubmon(overrides: Partial<PubMon> = {}): PubMon {
  return {
    id: 1,
    name: "Hoppsin",
    type: "beer",
    hp: 20,
    maxHp: 20,
    level: 5,
    xp: 0,
    attack: 10,
    defense: 10,
    moves: ["Grain Slam"],
    sprite: "hoppsin",
    description: "A hoppy little creature",
    cry: 1,
    visuals: "",
    ...overrides,
  };
}

function makeInitialPlayerState(overrides: any = {}) {
  return {
    info: { name: "TEST", sprite: "boy" },
    party: [makePubmon()],
    activeIndex: 0,
    badges: [],
    battleLog: [],
    ...overrides,
  };
}

function createTestActor(opts: { initialPlayerState?: any; initialGymId?: number; initialGamePhase?: "collection" | "tournament" | "hall-of-fame" } = {}) {
  const socket = new MockSocket();
  const actor = createActor(pubmonMachine, {
    input: {
      socket: socket as any,
      ...opts,
    },
  });
  actor.start();
  return { actor, socket };
}

function getViewState(actor: AnyActor): any {
  return actor.getSnapshot().value.view;
}

function getSyncState(actor: AnyActor): any {
  return actor.getSnapshot().value.sync;
}

// ============================================================================
// 1. INITIAL STATE
// ============================================================================

describe("Initial State", () => {
  test("machine starts in parallel state with sync.listening", () => {
    const { actor } = createTestActor();
    const sync = getSyncState(actor);
    expect(sync).toEqual({ listening: {} });
    actor.stop();
  });

  test("without party, initializing transitions to onboarding.welcome", () => {
    const { actor } = createTestActor();
    const view = getViewState(actor);
    expect(view).toEqual({ onboarding: "welcome" });
    actor.stop();
  });

  test("with initialPlayerState (has party), initializing transitions to mainLoop.crawl", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    const view = getViewState(actor);
    expect(view).toEqual({ mainLoop: "crawl" });
    actor.stop();
  });
});

// ============================================================================
// 2. ONBOARDING FLOW
// ============================================================================

describe("Onboarding Flow", () => {
  test("welcome -> NEXT -> genderSelect", () => {
    const { actor } = createTestActor();
    expect(getViewState(actor)).toEqual({ onboarding: "welcome" });
    actor.send({ type: "NEXT" });
    expect(getViewState(actor)).toEqual({ onboarding: "genderSelect" });
    actor.stop();
  });

  test("genderSelect -> SELECT_GENDER -> nameInput", () => {
    const { actor } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "boy" });
    expect(getViewState(actor)).toEqual({ onboarding: "nameInput" });
    actor.stop();
  });

  test("nameInput -> SUBMIT_NAME -> verifyingName (enters actor-invoking state)", () => {
    const { actor, socket } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "girl" });
    actor.send({ type: "SUBMIT_NAME", name: "ALICE" });
    expect(getViewState(actor)).toEqual({ onboarding: "verifyingName" });
    // Verify the socket was sent a check_name message
    expect(socket.sentMessages).toContainEqual({
      type: "check_name",
      name: "ALICE",
    });
    actor.stop();
  });

  test("verifyingName with name available -> confirmName", async () => {
    const { actor, socket } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "boy" });
    actor.send({ type: "SUBMIT_NAME", name: "BOB" });
    // Simulate server responding that name is available
    socket.simulateMessage({ type: "name_status", available: true });
    // Allow microtask to settle
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ onboarding: "confirmName" });
    actor.stop();
  });

  test("verifyingName with name taken -> takeoverPrompt", async () => {
    const { actor, socket } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "boy" });
    actor.send({ type: "SUBMIT_NAME", name: "TAKEN" });
    socket.simulateMessage({ type: "name_status", available: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ onboarding: "takeoverPrompt" });
    actor.stop();
  });

  test("confirmName -> CONFIRM_NAME -> creatingPlayer", async () => {
    const { actor, socket } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "boy" });
    actor.send({ type: "SUBMIT_NAME", name: "BOB" });
    socket.simulateMessage({ type: "name_status", available: true });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "CONFIRM_NAME" });
    expect(getViewState(actor)).toEqual({ onboarding: "creatingPlayer" });
    actor.stop();
  });

  test("confirmName -> REJECT_TAKEOVER -> nameInput", async () => {
    const { actor, socket } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "boy" });
    actor.send({ type: "SUBMIT_NAME", name: "BOB" });
    socket.simulateMessage({ type: "name_status", available: true });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "REJECT_TAKEOVER" });
    expect(getViewState(actor)).toEqual({ onboarding: "nameInput" });
    actor.stop();
  });

  test("takeoverPrompt -> REJECT_TAKEOVER -> nameInput", async () => {
    const { actor, socket } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "boy" });
    actor.send({ type: "SUBMIT_NAME", name: "TAKEN" });
    socket.simulateMessage({ type: "name_status", available: false });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "REJECT_TAKEOVER" });
    expect(getViewState(actor)).toEqual({ onboarding: "nameInput" });
    actor.stop();
  });

  test("takeoverPrompt -> CLAIM_PLAYER -> claimingPlayer", async () => {
    const { actor, socket } = createTestActor();
    actor.send({ type: "NEXT" });
    actor.send({ type: "SELECT_GENDER", gender: "boy" });
    actor.send({ type: "SUBMIT_NAME", name: "TAKEN" });
    socket.simulateMessage({ type: "name_status", available: false });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "CLAIM_PLAYER", name: "TAKEN" });
    expect(getViewState(actor)).toEqual({ onboarding: "claimingPlayer" });
    // Verify claim_player was sent
    expect(socket.sentMessages).toContainEqual(
      expect.objectContaining({ type: "claim_player", name: "TAKEN" }),
    );
    actor.stop();
  });

  test("PLAYER_CREATED with existing state + party -> mainLoop.crawl", () => {
    const { actor } = createTestActor();
    actor.send({
      type: "PLAYER_CREATED",
      playerInfo: { name: "EXISTING", gender: "girl" as const },
      existingState: makeInitialPlayerState(),
    });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    const ctx = actor.getSnapshot().context;
    expect(ctx.party.length).toBe(1);
    expect(ctx.playerInfo?.name).toBe("TEST");
    actor.stop();
  });

  test("PLAYER_CREATED without existing state -> starterSelect", () => {
    const { actor } = createTestActor();
    actor.send({
      type: "PLAYER_CREATED",
      playerInfo: { name: "NEW", gender: "boy" as const },
    });
    expect(getViewState(actor)).toEqual({ onboarding: "starterSelect" });
    actor.stop();
  });
});

// ============================================================================
// 3. NAVIGATION (MAIN LOOP)
// ============================================================================

describe("Navigation", () => {
  test("crawl -> NAVIGATE(team) -> team", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "team" });
    expect(getViewState(actor)).toEqual({ mainLoop: "team" });
    actor.stop();
  });

  test("crawl -> NAVIGATE(pokedex) -> pokedex", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "pokedex" });
    expect(getViewState(actor)).toEqual({ mainLoop: "pokedex" });
    actor.stop();
  });

  test("crawl -> NAVIGATE(league) -> league", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "league" });
    expect(getViewState(actor)).toEqual({ mainLoop: "league" });
    actor.stop();
  });

  test("team -> NAVIGATE(crawl) -> crawl", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "team" });
    actor.send({ type: "NAVIGATE", phase: "crawl" });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    actor.stop();
  });

  test("team -> NAVIGATE(pokedex) -> pokedex", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "team" });
    actor.send({ type: "NAVIGATE", phase: "pokedex" });
    expect(getViewState(actor)).toEqual({ mainLoop: "pokedex" });
    actor.stop();
  });

  test("league -> NAVIGATE(tournament) -> tournament.bracketView", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "league" });
    actor.send({ type: "NAVIGATE", phase: "tournament" });
    expect(getViewState(actor)).toEqual({ mainLoop: { tournament: "bracketView" } });
    actor.stop();
  });

  test("tournament.bracketView -> NAVIGATE(crawl) -> crawl", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "league" });
    actor.send({ type: "NAVIGATE", phase: "tournament" });
    actor.send({ type: "NAVIGATE", phase: "crawl" });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    actor.stop();
  });

});

// ============================================================================
// 4. BATTLE FLOW
// ============================================================================

describe("Battle Flow", () => {
  test("crawl -> ORDER_DRINK -> resolvingEncounter and sets encounter context", () => {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "ORDER_DRINK", drinkType: "beer" });
    expect(getViewState(actor)).toEqual({ mainLoop: "resolvingEncounter" });
    // Encounter context should be initialized (battleStartTime set, wildPubmon null)
    const ctx = actor.getSnapshot().context;
    expect(ctx.activeEncounter.battleStartTime).not.toBeNull();
    expect(ctx.activeEncounter.wildPubmon).toBeNull();
    // Socket should have sent order_drink
    expect(socket.sentMessages).toContainEqual(
      expect.objectContaining({ type: "order_drink", drinkType: "beer" }),
    );
    actor.stop();
  });

  test("resolvingEncounter on success -> standardBattle with wildPubmon set", async () => {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "ORDER_DRINK", drinkType: "shot" });
    // Simulate encounter result
    const wildMon = makePubmon({ id: 42, name: "Tequilar", type: "shot" });
    socket.simulateMessage({ type: "encounter_result", wildPubmon: wildMon });
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ mainLoop: "standardBattle" });
    const ctx = actor.getSnapshot().context;
    expect(ctx.activeEncounter.wildPubmon).toEqual(wildMon);
    actor.stop();
  });

  test("standardBattle -> CATCH -> resolvingCatch", async () => {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "ORDER_DRINK", drinkType: "beer" });
    socket.simulateMessage({ type: "encounter_result", wildPubmon: makePubmon({ id: 10 }) });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "CATCH" });
    expect(getViewState(actor)).toEqual({ mainLoop: "resolvingCatch" });
    // Should have sent catch_attempt
    expect(socket.sentMessages.some((m: any) => m.type === "catch_attempt")).toBe(true);
    actor.stop();
  });

  test("standardBattle -> RUN -> resolvingRun", async () => {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "ORDER_DRINK", drinkType: "beer" });
    socket.simulateMessage({ type: "encounter_result", wildPubmon: makePubmon({ id: 10 }) });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "RUN" });
    expect(getViewState(actor)).toEqual({ mainLoop: "resolvingRun" });
    expect(socket.sentMessages.some((m: any) => m.type === "run")).toBe(true);
    actor.stop();
  });

  test("standardBattle -> FAINT_DETECTED(win) -> resolvingBattle", async () => {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "ORDER_DRINK", drinkType: "beer" });
    socket.simulateMessage({ type: "encounter_result", wildPubmon: makePubmon({ id: 10 }) });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "FAINT_DETECTED", result: "win" });
    expect(getViewState(actor)).toEqual({ mainLoop: "resolvingBattle" });
    expect(socket.sentMessages.some((m: any) => m.type === "fight" && m.outcome === "win")).toBe(true);
    actor.stop();
  });

  test("standardBattle -> FAINT_DETECTED(loss) -> resolvingBattle", async () => {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "ORDER_DRINK", drinkType: "beer" });
    socket.simulateMessage({ type: "encounter_result", wildPubmon: makePubmon({ id: 10 }) });
    await new Promise((r) => setTimeout(r, 50));
    actor.send({ type: "FAINT_DETECTED", result: "loss" });
    expect(getViewState(actor)).toEqual({ mainLoop: "resolvingBattle" });
    expect(socket.sentMessages.some((m: any) => m.type === "fight" && m.outcome === "loss")).toBe(true);
    actor.stop();
  });
});

// ============================================================================
// 5. CELEBRATION FLOW
// ============================================================================

describe("Celebration Flow", () => {
  async function enterBattleAndWin(opts?: { catchResult?: any; fightResult?: any }) {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "ORDER_DRINK", drinkType: "beer" });
    const wildMon = makePubmon({ id: 10, name: "Lagerite" });
    socket.simulateMessage({ type: "encounter_result", wildPubmon: wildMon });
    await new Promise((r) => setTimeout(r, 50));
    return { actor, socket, wildMon };
  }

  test("catch success -> celebration.caught, then CONTINUE -> crawl", async () => {
    const { actor, socket } = await enterBattleAndWin();
    actor.send({ type: "CATCH" });
    const caughtMon = makePubmon({ id: 10, name: "Lagerite" });
    socket.simulateMessage({ type: "catch_result", success: true, pubmon: caughtMon });
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ mainLoop: { celebration: "caught" } });
    const ctx = actor.getSnapshot().context;
    expect(ctx.caughtPokemon).toEqual(caughtMon);

    // CONTINUE clears state and returns to crawl
    actor.send({ type: "CONTINUE" });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    const ctx2 = actor.getSnapshot().context;
    expect(ctx2.caughtPokemon).toBeNull();
    expect(ctx2.activeEncounter.wildPubmon).toBeNull();
    actor.stop();
  });

  test("battle win with xp -> celebration.xpGain, then CONTINUE -> crawl", async () => {
    const { actor, socket } = await enterBattleAndWin();
    actor.send({ type: "FAINT_DETECTED", result: "win" });
    socket.simulateMessage({
      type: "fight_result",
      outcome: "win",
      xpGained: 50,
      updatedParty: [makePubmon({ xp: 50 })],
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ mainLoop: { celebration: "xpGain" } });
    expect(actor.getSnapshot().context.xpGained).toBe(50);

    actor.send({ type: "CONTINUE" });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    expect(actor.getSnapshot().context.xpGained).toBe(0);
    actor.stop();
  });

  test("battle win with badge -> celebration.badgeReward -> CONTINUE -> xpGain -> CONTINUE -> crawl", async () => {
    const { actor, socket } = await enterBattleAndWin();
    actor.send({ type: "FAINT_DETECTED", result: "win" });
    socket.simulateMessage({
      type: "fight_result",
      outcome: "win",
      xpGained: 100,
      awardedBadgeId: 3,
      updatedParty: [makePubmon({ xp: 100 })],
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ mainLoop: { celebration: "badgeReward" } });
    expect(actor.getSnapshot().context.awardedBadgeId).toBe(3);
    expect(actor.getSnapshot().context.badges.has(3)).toBe(true);

    // CONTINUE from badgeReward -> xpGain
    actor.send({ type: "CONTINUE" });
    expect(getViewState(actor)).toEqual({ mainLoop: { celebration: "xpGain" } });
    expect(actor.getSnapshot().context.awardedBadgeId).toBeNull();

    // CONTINUE from xpGain -> crawl
    actor.send({ type: "CONTINUE" });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    actor.stop();
  });

  test("run -> celebration.ran with ranFromPubmon set, then CONTINUE -> crawl", async () => {
    const { actor, socket } = await enterBattleAndWin();
    const wildMon = actor.getSnapshot().context.activeEncounter.wildPubmon;
    actor.send({ type: "RUN" });
    // Simulate server confirming the run
    socket.simulateMessage({ type: "player_state", party: [makePubmon()] });
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ mainLoop: { celebration: "ran" } });
    const ctx = actor.getSnapshot().context;
    expect(ctx.ranFromPubmon).toEqual(wildMon);
    expect(ctx.ranBattleTurns).toBeGreaterThanOrEqual(1);
    // Encounter still set until CONTINUE
    actor.send({ type: "CONTINUE" });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    const ctx2 = actor.getSnapshot().context;
    expect(ctx2.ranFromPubmon).toBeNull();
    expect(ctx2.activeEncounter.wildPubmon).toBeNull();
    actor.stop();
  });

  test("battle loss -> crawl with encounter cleared", async () => {
    const { actor, socket } = await enterBattleAndWin();
    actor.send({ type: "FAINT_DETECTED", result: "loss" });
    socket.simulateMessage({
      type: "player_state",
      outcome: "loss",
      party: [makePubmon({ hp: 0 })],
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    expect(actor.getSnapshot().context.activeEncounter.wildPubmon).toBeNull();
    actor.stop();
  });
});

// ============================================================================
// 6. SYNC REGION (BACKGROUND EVENTS)
// ============================================================================

describe("Sync Region", () => {
  test("LEADERBOARD_SYNC updates leaderboard in context", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    const players = [
      { name: "RED", drinksLogged: 5, battlesWon: 3, totalBattles: 4, badges: [1, 2], partyCount: 6, level: 10 },
      { name: "BLUE", drinksLogged: 3, battlesWon: 1, totalBattles: 2, badges: [1], partyCount: 4, level: 7 },
    ];
    actor.send({ type: "LEADERBOARD_SYNC", players });
    expect(actor.getSnapshot().context.leaderboard).toEqual(players);
    actor.stop();
  });

  test("GYM_UPDATE updates currentGymId and gamePhase", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "GYM_UPDATE", currentGymId: 5, gamePhase: "tournament" });
    const ctx = actor.getSnapshot().context;
    expect(ctx.currentGymId).toBe(5);
    expect(ctx.gamePhase).toBe("tournament");
    actor.stop();
  });

  test("TOURNAMENT_STARTED updates tournamentState.bracket", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    const bracket = { matches: [{ id: 1 }], currentRound: 1 };
    actor.send({ type: "TOURNAMENT_STARTED", bracket });
    expect(actor.getSnapshot().context.tournamentState.bracket).toEqual(bracket);
    actor.stop();
  });

  test("BRACKET_UPDATE updates tournamentState.bracket", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    const bracket = { matches: [{ id: 1 }, { id: 2 }], currentRound: 2 };
    actor.send({ type: "BRACKET_UPDATE", bracket });
    expect(actor.getSnapshot().context.tournamentState.bracket).toEqual(bracket);
    actor.stop();
  });

  test("PLAYER_STATE_UPDATE updates party, activeIndex, badges, battleLog", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    const newParty = [makePubmon({ id: 1 }), makePubmon({ id: 2, name: "Lagerite" })];
    actor.send({
      type: "PLAYER_STATE_UPDATE",
      playerState: {
        party: newParty,
        activeIndex: 1,
        badges: [1, 3, 5],
        battleLog: [{ pokemon: makePubmon(), startTime: 1, endTime: 2, outcome: "win" }],
        tournamentOptIn: true,
      },
    });
    const ctx = actor.getSnapshot().context;
    expect(ctx.party).toEqual(newParty);
    expect(ctx.activeIndex).toBe(1);
    expect(ctx.badges).toEqual(new Set([1, 3, 5]));
    expect(ctx.battleLog.length).toBe(1);
    expect(ctx.tournamentState.isOptedIn).toBe(true);
    actor.stop();
  });

  test("sync events work regardless of current view state (e.g. in team view)", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "team" });
    expect(getViewState(actor)).toEqual({ mainLoop: "team" });
    // Sync event should still update context
    actor.send({ type: "LEADERBOARD_SYNC", players: [{ name: "X", drinksLogged: 1, battlesWon: 0, totalBattles: 0, badges: [], partyCount: 1, level: 1 }] });
    expect(actor.getSnapshot().context.leaderboard.length).toBe(1);
    // View should not have changed
    expect(getViewState(actor)).toEqual({ mainLoop: "team" });
    actor.stop();
  });
});

// ============================================================================
// 7. TOURNAMENT FLOW
// ============================================================================

describe("Tournament Flow", () => {
  test("tournament.bracketView -> MATCH_STARTED -> tournamentBattle with activeBattle set", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "league" });
    actor.send({ type: "NAVIGATE", phase: "tournament" });
    expect(getViewState(actor)).toEqual({ mainLoop: { tournament: "bracketView" } });

    actor.send({ type: "MATCH_STARTED", battleId: "battle-123", opponentName: "BLUE" });
    expect(getViewState(actor)).toEqual({ mainLoop: { tournament: "tournamentBattle" } });
    const ctx = actor.getSnapshot().context;
    expect(ctx.tournamentState.activeBattle).toEqual({
      battleId: "battle-123",
      opponentName: "BLUE",
    });
    actor.stop();
  });

  test("tournamentBattle -> FAINT_DETECTED -> resolvingBattle and clears activeBattle", () => {
    const { actor, socket } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "league" });
    actor.send({ type: "NAVIGATE", phase: "tournament" });
    actor.send({ type: "MATCH_STARTED", battleId: "battle-456", opponentName: "RED" });
    expect(getViewState(actor)).toEqual({ mainLoop: { tournament: "tournamentBattle" } });

    actor.send({ type: "FAINT_DETECTED", result: "win" });
    expect(getViewState(actor)).toEqual({ mainLoop: "resolvingBattle" });
    expect(actor.getSnapshot().context.tournamentState.activeBattle).toBeNull();
    actor.stop();
  });

});

// ============================================================================
// 8. CONTEXT INITIALIZATION
// ============================================================================

describe("Context Initialization", () => {
  test("default context has empty party and default values", () => {
    const { actor } = createTestActor();
    const ctx = actor.getSnapshot().context;
    expect(ctx.party).toEqual([]);
    expect(ctx.activeIndex).toBe(0);
    expect(ctx.badges).toEqual(new Set());
    expect(ctx.currentGymId).toBe(1);
    expect(ctx.gamePhase).toBe("collection");
    expect(ctx.leaderboard).toEqual([]);
    expect(ctx.activeEncounter.wildPubmon).toBeNull();
    expect(ctx.activeEncounter.battleStartTime).toBeNull();
    expect(ctx.tournamentState.isOptedIn).toBe(false);
    expect(ctx.tournamentState.bracket).toBeNull();
    expect(ctx.tournamentState.activeBattle).toBeNull();
    expect(ctx.battleLog).toEqual([]);
    expect(ctx.xpGained).toBe(0);
    expect(ctx.caughtPokemon).toBeNull();
    expect(ctx.awardedBadgeId).toBeNull();
    expect(ctx.ranFromPubmon).toBeNull();
    expect(ctx.ranBattleTurns).toBe(0);
    actor.stop();
  });

  test("with initialPlayerState, context is populated correctly", () => {
    const state = makeInitialPlayerState({ badges: [1, 2], battleLog: [{ pokemon: makePubmon(), startTime: 1, endTime: 2, outcome: "win" }] });
    const { actor } = createTestActor({ initialPlayerState: state });
    const ctx = actor.getSnapshot().context;
    expect(ctx.party.length).toBe(1);
    expect(ctx.party[0].name).toBe("Hoppsin");
    expect(ctx.playerInfo).toEqual({ name: "TEST", gender: "boy" });
    expect(ctx.badges).toEqual(new Set([1, 2]));
    expect(ctx.battleLog.length).toBe(1);
    actor.stop();
  });

  test("with initialGymId, currentGymId is set", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState(), initialGymId: 7 });
    expect(actor.getSnapshot().context.currentGymId).toBe(7);
    actor.stop();
  });

  test("with initialGamePhase, gamePhase is set", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState(), initialGamePhase: "tournament" });
    expect(actor.getSnapshot().context.gamePhase).toBe("tournament");
    actor.stop();
  });
});

// ============================================================================
// 9. GUARD TESTS
// ============================================================================

describe("Guards", () => {
  test("hasParty guard: false when party is empty -> goes to onboarding", () => {
    const { actor } = createTestActor();
    // No initialPlayerState = empty party = hasParty false = onboarding
    expect(getViewState(actor)).toEqual({ onboarding: "welcome" });
    actor.stop();
  });

  test("hasParty guard: true when party has items -> goes to mainLoop", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    actor.stop();
  });

  test("NAVIGATE guards prevent invalid transitions from crawl", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    // tournament is not a valid target from crawl (only team, pokedex, league)
    actor.send({ type: "NAVIGATE", phase: "tournament" });
    // Should stay in crawl
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    actor.stop();
  });

  test("NAVIGATE(settings) from crawl -> settings", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "settings" });
    expect(getViewState(actor)).toEqual({ mainLoop: "settings" });
    actor.stop();
  });

  test("NAVIGATE(crawl) from settings -> crawl", () => {
    const { actor } = createTestActor({ initialPlayerState: makeInitialPlayerState() });
    actor.send({ type: "NAVIGATE", phase: "settings" });
    actor.send({ type: "NAVIGATE", phase: "crawl" });
    expect(getViewState(actor)).toEqual({ mainLoop: "crawl" });
    actor.stop();
  });
});
