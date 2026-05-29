# PubMon Admin Console — UX Spec

A build-ready spec for the admin operations console (`app/admin/page.tsx`). The
admin runs a **live, in-person pub-crawl event**: pacing the crowd from gym to
gym, then running a single-elimination tournament on stage. This page is the
operator's cockpit. Optimize for **situational awareness and fast, confident
intervention**, not for the game's retro aesthetic.

> Aesthetic: this is an **ops dashboard**, not the GBA game UI. Use a clean,
> dense, high-contrast layout (the rest of the app is 320×240 pixel art — the
> admin page deliberately is not). Radix primitives are already available.

---

## 1. Mental model

The whole event has one **phase**, and the page reshapes around it:

| Phase | What the operator is doing | Primary action |
|---|---|---|
| `collection` | Pacing the crawl, watching opt-ins build | **Start Tournament** |
| `tournament` | Running the live bracket, intervening on matches | **End → Hall of Fame** / **Reset Tournament** |
| `hall-of-fame` | Showing results, awarding ribbons | **Reset to Collection** (new event) |

Three design pillars:
1. **Phase-aware single dashboard** — one obvious primary action at all times.
2. **The bracket is the cockpit** — during a tournament, interventions live *on*
   each match card, next to live timers.
3. **Surface stalls** — idle battle timers go amber/red so an unresponsive
   player is impossible to miss; resolution is one click away.

---

## 2. Layout

Persistent top **command bar**, a phase-driven **primary workspace** (left/main),
a persistent **player directory** (right rail), and a collapsible **raw state**
footer.

### Tournament phase (the dense case)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PUBMON ADMIN        ● connected   secret ••••      PHASE: ⚔ TOURNAMENT · R2/3  │
│ ┌────────────┐ ┌──────────────────┐ ┌────────────────────────────────────┐   │
│ │ Gym [ 4 ▾] │ │ 7 players · 6 in  │ │ ⟲ Reset Tournament   🏆 End → HoF   │   │
│ │  Set Gym   │ │   tournament      │ │ (destructive, confirm)              │   │
│ └────────────┘ └──────────────────┘ └────────────────────────────────────┘   │
├──────────────────────────────────────────────────┬───────────────────────────┤
│ LIVE BRACKET                                       │ PLAYERS                   │
│                                                    │ ┌───────────────────────┐ │
│ ── Round 2 of 3 ──────────────────────────────     │ │ 🔍 filter…            │ │
│ ┌────────────────────────────────────────────────┐ │ ├───────────────────────┤ │
│ │ Match 1                  ⏱ 2:14   💤 0:48 ▲amber │ │ │ ACE   ✅ Lv12  ●       │ │
│ │  🟦 ACE   ▓▓▓▓▓░  vs  ░▓▓▓▓▓  FINN 🟥             │ │ │ BREE  ✅ Lv11  ●       │ │
│ │  [◀ ACE wins]   [FINN wins ▶]   [Void]           │ │ │ GHOST ✅ Lv9   ◌ idle  │ │
│ └────────────────────────────────────────────────┘ │ │ DREW  ✅ Lv10  ●       │ │
│ ┌────────────────────────────────────────────────┐ │ │ …                     │ │
│ │ Match 2                              ✓ completed │ │ └───────────────────────┘ │
│ │  BREE 🏆 ─────── def. ─────── ELLE               │ │ ▸ selected: GHOST         │
│ │  [Reopen]                                        │ │   ribbon [ Champion ▾]    │
│ └────────────────────────────────────────────────┘ │   [ Give ribbon ]         │
│                                                    │   [ Re-add to bracket ]   │
├──────────────────────────────────────────────────┴───────────────────────────┤
│ ▸ Raw game state (debug)                          [ Refresh ]   [ Copy JSON ]  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Collection phase

Primary workspace becomes a **roster-prep / pacing** view: big current-gym
control, opt-in tally ("6 of 7 opted in · 7 have a party"), and the player
directory emphasized. Primary action **Start Tournament** is disabled until ≥2
players satisfy `tournamentOptIn && party.length > 0` (tooltip explains why).

### Hall-of-fame phase

Primary workspace becomes **final standings**: champion banner, ribbon overview
per player, and **Reset to Collection** to start a fresh event.

---

## 3. Components

### 3.1 Command bar (all phases)
- **Connection + auth**: connection dot; admin secret input (persisted in
  `localStorage["pubmon_admin_secret"]`, sent on every admin message). On an
  `{type:"error", message:"Invalid admin credentials"}` reply, show an inline
  auth error and re-prompt.
- **Phase chip**: `collection | tournament | hall-of-fame`; in tournament also
  show `Round N of M` (M is derivable from initial bracket size; if unknown,
  show just `Round N`).
- **Gym selector** (`1–10`) + **Set Gym**. This is the crawl-pacing control —
  available in every phase.
- **Phase primary actions** (see §1 table). All destructive ones require a
  confirm dialog.

### 3.2 Live bracket (tournament phase)
Group matches by round; render the **current** round expanded, prior rounds
collapsible. Each **match card** shows both players (name, sprite/avatar, a
HP-ish vs. bar is optional flourish), a **status badge**, a **timer row** when
`in_progress`, and **intervention buttons**.

**Status badges:** `pending` (queued), `in_progress` (live, animated), `completed`
(✓ + winner), `forfeited` (walkover / void), bye (auto-completed, no controls).

**Intervention model — one vocabulary, three buttons** on an `in_progress`
match (this replaces thinking in terms of promote/kick/forfeit):
- **`◀ {P1} wins`** / **`{P2} wins ▶`** — declare that player the winner.
  *(Removing an unresponsive player = declare the opponent the winner.)*
- **`Void`** — resolve with **no winner**; nobody advances into that slot.
- On a `completed`/`forfeited` match: **`Reopen`** — clear the result and put it
  back in play.

⚠️ **Void warning:** if voiding a match would leave the round with exactly one
remaining winner, voiding will auto-crown that player champion. The card must
warn ("This will end the tournament and crown {name}") before confirming.

### 3.3 Battle timers (the stall detector)
For each `in_progress` match the admin **spectates the battle room** (read-only
WebSocket to `/parties/battle/{battleId}` — see §4.3). Show:
- **⏱ total** = `now − startedAt`
- **💤 idle** = `now − lastMoveAt` (time since last move)

Both tick locally (1s). Derive a clock offset from the `serverNow` field of the
last `battle_state` so timers are accurate despite clock skew:
`offset = clientReceiveTime − serverNow`, then `idle = (Date.now() − offset) − lastMoveAt`.

**Thresholds:** idle > **60s → amber**, idle > **120s → red**. A red card is the
cue to `Void` or declare the present player the winner.

**Never-joined vs. stalled:** if a battle room never reaches `active` (an
opponent never joined), there's no `battle_state`; show
`"waiting for {opponent} to join"` with total since the match's `match_start`,
and the same intervention buttons apply.

### 3.4 Player directory (right rail, all phases)
Searchable list driven by `leaderboard_sync` + `admin_state`. Per row: name,
opt-in ✅, level, badge count, and an **online/idle** indicator derived from
`lastActivity` in `admin_state` (e.g. idle if `now − lastActivity > 60s`).
Selecting a player reveals:
- **Assign ribbon** (dropdown of the 10 ribbons in §5) → **Give ribbon**.
- **Re-add to bracket** (recovery for a wrongly-removed player).

### 3.5 Raw state (collapsible footer)
On-demand full `admin_state` dump (pretty JSON, copyable). Backstop for anything
the structured UI doesn't surface.

---

## 4. Data contracts

The admin page is a WebSocket client of the **main room**
`ws://<host>/parties/main/global`, plus read-only **battle rooms** for live
timers. Everything below is the wire format the UI binds to.

`✳️ NEW` = being added on the backend in parallel with this UI work; the shape is
final, treat it as available.

### 4.1 Admin → server (main room). Every message includes `adminSecret: string`.

| Message | Fields | Effect |
|---|---|---|
| `admin_set_gym` | `gymId: number` | Sets global gym; broadcasts `gym_update`. |
| `admin_start_tournament` | — | Seeds bracket from opted-in players w/ a party; `phase → tournament`; broadcasts `tournament_start`. No-op if < 2 eligible. |
| `admin_resolve_match` ✳️ NEW | `matchId: string`, `winnerId: string \| null` | Authoritative resolve. `winnerId`=sessionId → that player wins; `null` → **void** (no winner advances). Releases both players, ends the live battle, advances the round when complete. |
| `admin_reset_tournament` ✳️ NEW | — | Clears the bracket, `phase → collection`, clears everyone's active battle. **Opt-ins are preserved** so you can immediately Start again. |
| `admin_promote_player` | `matchId: string`, `sessionId: string` | Legacy alias of resolve(winner). Declare winner. |
| `admin_kick_player` | `matchId: string`, `sessionId: string` | Remove a player; opponent advances by walkover. (Equivalent to resolve with the opponent as winner.) |
| `admin_forfeit_match` | `battleId: string`, `forfeitSessionId: string` | Forfeit keyed by battleId; opponent advances. |
| `admin_readd_player` | `sessionId: string` | Adds a bye match for the player into the current bracket. |
| `admin_assign_ribbon` | `sessionId: string`, `ribbonPath: string` | Grants a ribbon (idempotent). |
| `admin_trigger_hall_of_fame` | — | Computes auto-ribbons; `phase → hall-of-fame`; broadcasts `hall_of_fame_ready`. |
| `admin_request_state` | — | Server replies with `admin_state` (full dump). |

> The UI should prefer **`admin_resolve_match`** for all per-match actions
> (winner / void) and `admin_readd_player` for recovery. `promote/kick/forfeit`
> remain valid but `resolve_match` covers the whole intervention vocabulary.

### 4.2 Server → admin (main room)

```ts
// phase + global gym (sent on connect and whenever they change)
{ type: "gym_update", currentGymId: number,
  gamePhase: "collection" | "tournament" | "hall-of-fame" }

// live player table (sent on connect and on relevant changes)
{ type: "leaderboard_sync", players: Array<{
    name: string; drinksLogged: number; battlesWon: number;
    totalBattles: number; badges: number[]; partyCount: number;
    level: number; tournamentOptIn: boolean;
}> }

// bracket lifecycle
{ type: "tournament_start", bracket: TournamentBracket }   // entering tournament
{ type: "bracket_update",   bracket: TournamentBracket }   // any bracket change
{ type: "match_start",  battleId: string,
    player1SessionId: string, player1Name: string,
    player2SessionId: string, player2Name: string }        // a match went live
{ type: "match_complete", battleId: string, winnerId: string,
    winnerName: string, durationMs?: number, moveCount?: number } // ✳️ NEW: durationMs, moveCount

{ type: "hall_of_fame_ready", hallOfFame: Record<string /*sessionId*/, string[] /*ribbonPaths*/> }

// full debug snapshot (reply to admin_request_state)
{ type: "admin_state", state: SerializableGameState }

{ type: "error", message: string }
```

```ts
interface TournamentBracket {
  round: number;
  matches: TournamentMatch[];
  champion?: string;       // sessionId of final winner — set ⇒ tournament over
  championName?: string;
}
interface TournamentMatch {
  matchId: string;
  player1SessionId: string;
  player2SessionId: string | null;          // null ⇒ bye
  battleId?: string;                         // set once the match is live
  winnerId?: string;                         // set when resolved (absent ⇒ void)
  status: "pending" | "in_progress" | "completed" | "forfeited";
  adminOverride?: boolean;                   // true ⇒ resolved by admin
}
interface SerializableGameState {
  phase: "collection" | "tournament" | "hall-of-fame";
  currentGymId: number;
  players: Record<string /*sessionId*/, SerializablePlayerState>;
  tournamentBracket?: TournamentBracket;
  hallOfFame?: Record<string, string[]>;
}
interface SerializablePlayerState {
  sessionId: string;
  info: { name: string; sprite: string };
  party: PubMon[];            // PubMon: { id, name, type, level, hp, maxHp, xp, moves[], ... }
  activeIndex: number;
  badges: number[];
  battleLog: Array<{ pokemon: PubMon; startTime: number; endTime: number;
                     outcome: "win" | "caught" | "run" | "lose" }>;
  tournamentOptIn: boolean;
  ribbons: string[];          // ribbon sprite paths
  createdAt: number;
  lastActivity: number;       // use for online/idle indicator
  activeBattleId?: string;
  activeBattleOpponent?: string;
}
```

**Champion detection:** the tournament is over when `bracket.champion` is set
(also crowned via `bracket_update`). Show the champion banner / enable the HoF
flow off that.

### 4.3 Battle room (read-only spectate, for live timers)
Open `ws://<host>/parties/battle/{battleId}` for each `in_progress` match. **Do
not send `battle_join`** (that registers you as a player) — just listen. The
server sends the current `battle_state` on connect (✳️ NEW) and on every move.

```ts
{ type: "battle_state", battleId: string,
  player1: { name: string; activePubmon: PubMon; partyCount: number },
  player2: { name: string; activePubmon: PubMon; partyCount: number },
  currentTurn: "player1" | "player2", turnCount: number,
  startedAt: number,   // ✳️ NEW  epoch ms battle became active
  lastMoveAt: number,  // ✳️ NEW  epoch ms of the last accepted move
  serverNow: number }  // ✳️ NEW  server clock at send time (for offset calc)

{ type: "battle_update", events: string[] }   // raw @pkmn protocol lines (optional to render)
{ type: "battle_end", winnerId: string, winnerName: string,
  reason?: "natural" | "admin" | "forfeit" | "void" }   // ✳️ NEW reason
{ type: "battle_error", message: string }
```

Close the battle socket when the match leaves `in_progress`.

---

## 5. Ribbons (assignable)
`champion`, `effort`, `expert-battler`, `legend`, `best-friends`, `artist`,
`careless`, `relax`, `smile`, `snooze`. Paths are `/sprites/ribbons/{name}-ribbon.png`
(except `champion-ribbon.png` etc. — match existing values:
`/sprites/ribbons/champion-ribbon.png`, `…/effort-ribbon.png`,
`…/expert-battler-ribbon.png`, `…/legend-ribbon.png`, `…/best-friends-ribbon.png`,
`…/artist-ribbon.png`, `…/careless-ribbon.png`, `…/relax-ribbon.png`,
`…/smile-ribbon.png`, `…/snooze-ribbon.png`).

---

## 6. States & edge cases
- **No auth / bad secret:** gate all actions; show inline error on `error` msg.
- **Disconnected socket:** show offline state; auto-reconnect; re-request state.
- **Start disabled:** < 2 eligible players (opted-in + has party).
- **Bye matches:** auto-completed, render read-only (no intervention buttons).
- **Void auto-crown:** warn when a void would end the round/tournament (§3.2).
- **Reset is destructive:** confirm; note opt-ins are kept.
- **Stalled vs never-joined battle:** distinct copy (§3.3); both kickable.
- **Champion set:** lock further bracket edits except an explicit Reopen of the
  final; surface the HoF flow.

---

## 7. Suggested decomposition
`CommandBar` · `PhaseWorkspace` (switches on phase) · `LiveBracket` → `MatchCard`
(+ `BattleTimer`) · `PlayerDirectory` → `PlayerDetail` · `RawState`. A
`useAdminSocket` hook for the main connection and a `useBattleTimers` hook that
manages the per-match spectate sockets and exposes `{ total, idle, level }`.
</content>
