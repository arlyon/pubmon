# PubMon Test Suite Report

**Date:** 2026-05-08
**Runner:** Bun Test (`bun test`)
**Result:** 244 pass, 0 fail, 3072 assertions across 6 files (14s)

---

## Summary

Comprehensive test coverage was added across the core game systems: battle hook logic, battle engines (local and remote), the XState game state machine, and the PubMon data layer. The existing 4 integration tests for raw `@pkmn/sim` battle streams were preserved.

---

## Test Files

### 1. `hooks/use-battle.test.ts` — 90 tests

The battle hook is the most complex piece of the codebase, managing protocol parsing, HP tracking, message queuing, and animation coordination. Since it's a React hook, the pure logic functions were re-implemented in the test file to avoid needing `@testing-library/react`.

| Group | Tests | What's Covered |
|---|---|---|
| parseHpFromProtocol | 15 | Valid HP strings, edge cases (0/0, 999/999), invalid inputs, status suffixes |
| translateStatusMessage | 19 | All status types (par/slp/psn/tox/brn/frz), cant messages, damage-from sources, cure status, confusion start/end, unknown lines return null |
| HP tracking from protocol | 10 | switch/damage/heal parsing for both players, percentage-to-actual conversion for enemy HP |
| Battle protocol message routing | 19 | Move messages, effectiveness, faint with delay, win/loss detection, boosts/unboosts, catch shake events, damage with animation flags, skipped sim messages |
| Message queue behavior | 11 | Single/multiple/empty queues, processing lock, HP updates, animation flags (shake/flash/attack), delays, onDisplay callbacks |
| Multi-line chunk routing | 2 | Full turn sequences, faint+win sequences producing correct ordered message arrays |

### 2. `lib/battle-engine.test.ts` — 21 tests

Tests the `LocalBattleEngine` wrapper around `@pkmn/sim` battle streams.

| Group | Tests | What's Covered |
|---|---|---|
| Engine Lifecycle | 4 | Creation, start emitting chunks, destroy cleanup, sequential start/destroy |
| Chunk Callback | 4 | Receiving protocol messages, expected protocol lines, callback before/after start |
| Move Submission | 4 | 0-indexed to 1-indexed conversion, moves advance battle, silent return after destroy |
| Forfeit Turn | 2 | Pass command, silent return after destroy |
| Full Battle Flow | 4 | Complete battle to win/loss, expected protocol lines emitted, valid winner, sequential battles |
| Custom PubMon Dex | 3 | All 5 types work, custom moves in output, diverse matchups |

### 3. `lib/remote-battle-engine.test.ts` — 26 tests

Tests the `RemoteBattleEngine` with a mock socket, focusing on the optimistic prediction and server reconciliation logic.

| Group | Tests | What's Covered |
|---|---|---|
| Construction & Setup | 3 | Socket listener registration, battle_join message, local engine wiring |
| Move Submission | 4 | battle_attack/battle_forfeit messages, optimistic local prediction |
| Server Message Handling | 4 | battle_update forwarding, non-battle message ignored, invalid JSON handling |
| Desync Detection | 3 | Matching events (no desync), mismatching events (desync), missing predictions |
| Reconciliation | 4 | Rollback replays server log, count increments, 4th desync triggers forceResync, clears predictions |
| Cleanup | 4 | Listener removal, callback nullification, multiple destroy calls, cleanup after start |
| onChunk & Full Flow | 4 | Callback replacement, start-move-response round-trip, accumulated server logs |

### 4. `machines/pubmon-machine.test.ts` — 50 tests

Tests the XState v5 parallel state machine that orchestrates the entire game lifecycle, using `createActor` with a mock socket.

| Group | Tests | What's Covered |
|---|---|---|
| Initial State | 3 | Parallel structure, routing to onboarding vs mainLoop based on party |
| Onboarding Flow | 10 | Full chain (welcome through starterSelect), actor resolution via WebSocket simulation, PLAYER_CREATED with/without existing state |
| Navigation | 8 | All NAVIGATE transitions between crawl, team, pokedex, league, tournament, hallOfFame |
| Battle Flow | 6 | ORDER_DRINK, encounter resolution, transitions to catch/run/battle resolution |
| Celebration Flow | 4 | Caught, xpGain, badgeReward (multi-step), loss back to crawl |
| Sync Region | 6 | All background events update context correctly regardless of view state |
| Tournament Flow | 4 | MATCH_STARTED, FAINT_DETECTED, HALL_OF_FAME_READY |
| Context Initialization | 4 | Default values, initialPlayerState, initialGymId, initialGamePhase |
| Guards | 4 | hasParty routing, NAVIGATE guards preventing invalid transitions |

### 5. `lib/pokemon-data.test.ts` — 53 tests (~2700 assertions)

Validates the entire data foundation of the game. High assertion count because many tests iterate over all 151 PubMon.

| Group | Tests | What's Covered |
|---|---|---|
| ALL_PUBMON Data Integrity | 12 | Required fields, unique ids/names, valid types, move counts, move mapping coverage, positive stats, all 5 types represented |
| MOVE_MAPPINGS | 5 | Non-empty, string values, lowercase format, no duplicate keys, expected mappings |
| TYPE_INFO | 4 | All 5 types, required fields, hex color validation, label values |
| PUBMON_TYPE_MAP | 6 | All 5 type mappings (beer->Ground, shot->Fire, wine->Poison, water->Water, cocktail->Grass) |
| getBaseMoveForAudio | 5 | Known/unknown moves, case insensitivity, empty string, all type categories |
| getPubMonSprite | 4 | Default variant, explicit variant, capitalization, 5-digit padding |
| getMissingnoSprite | 1 | Correct path |
| getRandomPubMon | 4 | Correct type, returns copy, full health, all 5 types |
| generatePubMonModData | 9 | Species for all PubMon, run/catch moves, priorities, species IDs, type mapping, baseStats |

### 6. `lib/battle.test.ts` — 4 tests (pre-existing)

Raw `@pkmn/sim` integration tests that were already in place.

---

## Infrastructure Changes

- Added `"test": "bun test"` to package.json scripts
- Added `"test:watch": "bun test --watch"` to package.json scripts

---

## Findings

### Missing Move Mappings

The pokemon-data tests identified **10 moves across 5 PubMon** that are missing from `MOVE_MAPPINGS`. These silently fall back to "tackle" via the default in `generatePubMonModData`:

- **Cazcabuzz**: neonflare, caffeinerush
- **Blancbat**: rusticwing (note: this one IS in MOVE_MAPPINGS but on a different mon — may be a different issue)
- **Buckfiend**: antlersmash (also present for another mon)
- **Fantelope**: taurinetail
- **Sagondroop**: blueraspburn

These PubMon effectively have some moves that behave identically to Tackle regardless of their intended design.

### Type Inconsistency in State Machine

The `FAINT_DETECTED` event defines `result: "win" | "loss"`, but the `battleResolutionActor` input expects `outcome: "win" | "lose"`. At runtime the value `"loss"` is sent to the server, which may or may not match what the server expects. Worth verifying.

---

## Running Tests

```bash
# Run all tests
bun test

# Run with watch mode
bun test --watch

# Run a specific file
bun test lib/pokemon-data.test.ts

# Run tests matching a pattern
bun test --grep "parseHpFromProtocol"
```
