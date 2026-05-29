# PubMon

A retro-pixel PWA for real-world pub crawls. Players catch drink-themed creatures at actual pubs, manage a party of 6, and compete in a live Master Tournament. GBA aesthetic (320x240 logical resolution) scaled to modern screens.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion
- **State:** XState v5 - single parallel machine (`machines/pubmon-machine.ts`) orchestrates the entire game lifecycle
- **Backend:** PartyKit on Cloudflare Durable Objects (`src/servers/`)
- **Battle Engine:** `@pkmn/sim` with a custom "pubmon" mod mapping themed moves to Gen 1 base mechanics
- **Audio:** Howler.js via `useAudio` hook
- **Physics:** Matter.js for the Play mode sandbox

## Running

```bash
npm run dev            # Next.js frontend (localhost:3000)
npm run server:dev     # Wrangler PartyKit server
npm run server:deploy  # Deploy server to Cloudflare
```

## Architecture

### Servers (`src/servers/`)

Two PartyKit Durable Objects, routed in `src/index.ts`:

- **MainEventServer** (`main/global`): Canonical source of truth. Handles player accounts, party/pokedex storage, drink ordering, encounter RNG, gym control, leaderboards, and tournament brackets. All player state mutations happen here.
- **BattleServer** (`battle/{id}`): Ephemeral rooms for P2P tournament matches. Runs `@pkmn/sim` server-side, validates turns, and reports results back to MainEventServer.

### State Machine (`machines/pubmon-machine.ts`)

Parallel machine with two regions:

1. **sync** - Background WebSocket listener. Translates server broadcasts (`gym_update`, `leaderboard_sync`, `tournament_start`, `bracket_update`, `player_state`) into machine events.
2. **view** - Hierarchical view router:
   - `initializing` -> checks for existing player state
   - `onboarding` -> welcome, gender, name, starter selection
   - `mainLoop` -> crawl | team | pokedex | league | tournament | hallOfFame
   - Battle substates: `resolvingEncounter` -> `standardBattle` -> `resolvingCatch`/`resolvingRun`/`resolvingBattle` -> celebration (`caught`/`xpGain`/`badgeReward`)

### Battle Engines (`lib/battle-engine.ts`)

- **LocalBattleEngine**: Client-side only, used for wild encounters. Wraps `@pkmn/sim` BattleStreams with RandomPlayerAI opponent.
- **RemoteBattleEngine**: P2P with server authority. Runs optimistic local prediction for responsive animations, reconciles against canonical server events. Auto-rollback on desync (up to 3 attempts before force resync).

### Type System

PubMon types map to Pokemon Showdown types for mechanical balance:

| PubMon Type | Engine Type | Thematic Flavor |
|-------------|-------------|-----------------|
| Beer        | Ground      | Heavy, earthy   |
| Shot        | Fire        | Fast, explosive |
| Wine        | Poison      | Status-heavy    |
| Water       | Water       | Defensive       |
| Cocktail    | Grass       | Mixed, tricky   |

## Directory Map

```
app/
  page.tsx              # Main game entry, fetches initial state from server
  admin/page.tsx        # Admin dashboard: gym control, tournament, hall of fame
  manifest.ts           # PWA manifest
components/
  game-shell.tsx        # Root orchestrator, connects XState to UI, routes views
  player-create.tsx     # Onboarding: welcome, gender, name
  starter-select.tsx    # Starter pokemon selection
  drink-select.tsx      # Crawl view: trainer card, drink ordering
  battle-screen.tsx     # Battle UI: HP bars, move menu, animations
  team-management.tsx   # Party roster, set lead, launch Play mode
  tournament-bracket-viewer.tsx
  hall-of-fame-viewer.tsx
  play-canvas.tsx       # Matter.js physics sandbox
  pixel/                # Atomic retro components (PixelBox, PixelHPBar, etc.)
  ui/                   # Radix UI primitives
hooks/
  use-battle.ts         # Battle logic: protocol parsing, HP tracking, message queue
  use-audio.ts          # BGM/SFX with volume ducking
lib/
  pokemon-data.ts       # PubDex (151 creatures), move mappings, type definitions
  battle-engine.ts      # Local + Remote engine implementations
  gym-data.ts           # 10 gyms + Master Tournament definitions
  physics-utils.ts      # Sprite-to-hitbox generation from pixel data
machines/
  pubmon-machine.ts     # XState v5 game state machine
src/
  index.ts              # PartyKit router
  servers/
    MainEventServer.ts  # Global game state Durable Object
    BattleServer.ts     # Ephemeral P2P battle rooms
```

## Fonts

Two fonts are available via CSS variables:

- `font-sans` / `font-mono` — **Emerald** (`--font-emerald`), a color bitmap font with built-in foreground + shadow colors. This is the default body font.
- `font-heading` — **Press Start 2P** (`--`), used for headings/titles.

### Emerald Font Palettes

The Emerald font is a **color font** — it has two color channels baked in (slot 0 = foreground, slot 2 = shadow). Standard CSS `color` has no effect. Instead, use `font-palette` to switch color schemes:

| Utility class            | FG color       | Shadow color     |
|--------------------------|----------------|------------------|
| `font-palette-default`   | Dark `#282828` | Light gray       |
| `font-palette-no-shadow` | Dark `#282828` | Transparent      |
| `font-palette-blue`      | White          | Deep blue        |
| `font-palette-red`       | White          | Deep red         |
| `font-palette-yellow`    | Bright yellow  | Dark gold        |
| `font-palette-green`     | Bright green   | Dark green       |
| `font-palette-white`     | White          | Gray             |
| `font-palette-muted`     | Muted gray     | Very light       |

Usage: `<span className="font-sans font-palette-blue">White on blue</span>`

To add new palettes, define a `@font-palette-values` block in `globals.css` and a matching utility class.

## Development Guidelines

1. **State as event.** Never mutate player state directly. Dispatch events to the XState machine; let `PLAYER_STATE_UPDATE` from the server sync the UI.
2. **Pixel scaling.** Use `w-gba-[X]`, `h-gba-[X]`, `text-gba-[X]`, `p-gba-[X]`, `gap-gba-[X]` Tailwind utilities instead of standard spacing. All sprites must use `image-rendering: pixelated`.
3. **Audio.** Always use the `useAudio` hook for BGM/SFX. It handles cleanup and volume ducking between tracks.
4. **Session auth.** Frictionless UUID stored in `pubmon_session_id` cookie. No passwords.
5. **Move mappings.** Custom move names (e.g. "Grain Slam") map to Gen 1 base moves in `pokemon-data.ts`. This preserves theme while keeping mechanical balance.
6. **Physics hitboxes.** Auto-generated from non-transparent sprite pixels via `physics-utils.ts`. No manual hitbox definitions.

## WebSocket Protocol

Client -> Server messages: `check_name`, `create_player`, `claim_player`, `select_starter`, `order_drink`, `catch_attempt`, `fight`, `run`, `set_active_mon`, `opt_in_tournament`

Server -> Client broadcasts: `gym_update`, `leaderboard_sync`, `tournament_start`, `bracket_update`, `hall_of_fame_ready`

Admin messages: `admin_set_gym`, `admin_start_tournament`, `admin_promote_player`, `admin_kick_player`, `admin_assign_ribbon`, `admin_trigger_hall_of_fame`, `admin_request_state`

## Game Design Reference

See [GAMEDEV.md](GAMEDEV.md) for the full game loop documentation including character creation, encounters, battles, gym progression, tournament flow, and the physics playground.
