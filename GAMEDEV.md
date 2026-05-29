# PubMon Game Design Document

This document describes every game loop in PubMon, from first launch to the Hall of Fame.

---

## 1. Session & Authentication

PubMon uses frictionless session auth. On first visit, a UUID is generated and stored in a `pubmon_session_id` cookie. No passwords, no sign-up forms. The server associates all player data with this session ID.

If a player returns on a different device, they can reclaim their account by entering the same trainer name (see Name Recovery below).

---

## 2. Character Creation (Onboarding)

The onboarding flow is a linear sequence managed by the XState machine's `onboarding` state.

### 2.1 Welcome Sequence

Professor Barley (the game's equivalent of Professor Oak) greets the player with a bouncing pixel sprite over a scenic background. Four dialog screens introduce the world:

1. Welcome to the world of PubMon
2. Explanation of what PubMon creatures are
3. The player's role as a trainer
4. Transition to character setup

The player advances each dialog by tapping.

### 2.2 Gender Selection

Professor presents two options: BOY or GIRL. This determines the trainer sprite used throughout the game (overworld avatar, trainer card, battle screen).

### 2.3 Name Input

The player enters a trainer name (max 10 characters). The name is validated in real-time against the server via a `check_name` WebSocket message.

- **Name available:** Proceeds to confirmation.
- **Name taken:** Prompts with "This name belongs to an existing trainer. Is that you?" The player can either claim the existing account (name recovery) or go back and pick a different name.

### 2.4 Name Recovery

If the player claims an existing name, the server sends back the full player state (party, badges, pokedex). The machine transitions directly to `mainLoop` with the restored state, skipping starter selection.

### 2.5 Account Creation

For new names, the server creates a fresh player record and returns `player_created` + initial `player_state`. The machine transitions to starter selection.

---

## 3. Starter Selection

### 3.1 Professor's Introduction

Professor Barley delivers 6 dialog screens explaining:

- The five types of PubMon (Beer, Shot, Wine, Water, Cocktail)
- How drink ordering triggers wild encounters
- The importance of choosing a first companion

Five pokeball icons are displayed below the professor, one per type.

### 3.2 Type Selection

The player is presented with all 5 drink types in a vertical list. Each entry shows:

- A colored type icon (8x8 pixel grid)
- The starter PubMon's name for that type
- A type badge

### 3.3 Confirmation & Receive

After selecting a type:

1. **Confirm screen:** Shows the starter with animated sprite (64px), name, type badge, and full description. YES to confirm, NO to go back.
2. **Receive screen:** Celebration animation with the chosen PubMon revealed at center, sparkle particles in the type's color, and the creature's cry playing.

The machine sends `SELECT_STARTER` and transitions to `mainLoop/crawl`.

---

## 4. The Crawl (Main Game Hub)

The crawl is the default view and primary gameplay loop. It represents the player exploring the current pub/gym.

### 4.1 Trainer Card

Displayed on the left side of the crawl view:

- Pixel art trainer sprite
- Current level and XP bar (animated fill)
- Stats grid: Battles fought, Badges earned, Pubdex completion, Status

### 4.2 Current Gym

The top of the crawl view shows the active gym (set by the admin in real-time). Gyms represent actual pubs in the real-world pub crawl. Each gym has:

- A name, badge type, and specialty drink type
- A leader name and location flavor text
- A required number of drinks to order

### 4.3 Drink Ordering

The player selects from 5 drink types (Beer, Shot, Wine, Water, Cocktail) displayed in a grid with colored icons. Each has a pulsing selector indicator when highlighted.

Pressing "ORDER [TYPE]" sends `ORDER_DRINK` to the machine, which:

1. Triggers a battle transition animation (bar-blinds pixel wipe)
2. Sends `order_drink` to the server
3. Server performs RNG encounter generation based on the drink type
4. Returns a wild PubMon appropriate to the selected type
5. Machine transitions to `standardBattle`

### 4.4 Tournament Awareness

When a tournament is active and the player has a pending match, the crawl view shows the opponent's name and a "JOIN BATTLE" button.

---

## 5. Wild Encounters (Single-Player Battle)

Wild encounters use the **LocalBattleEngine**, running `@pkmn/sim` entirely in the browser.

### 5.1 Battle Entry

1. Bar-blinds transition covers the screen (80 frames at 16ms)
2. Arena background renders with type-specific gradient
3. Enemy PubMon slides in from the right (80-frame animation with quadratic easing)
4. Enemy cry plays on slide-in completion
5. Stat cards animate in (enemy top-left, player bottom-right)
6. Battle menu appears

### 5.2 Battle Menu

The main menu offers four options:

- **FIGHT** - Opens move selection (2x2 grid of 4 moves showing name and PP/MaxPP)
- **CATCH** - Attempts to capture the wild PubMon
- **BAG** - Not yet implemented (shows a brief message)
- **RUN** - Attempts to flee

CATCH and RUN are implemented as special moves injected into the battle protocol, so the sim engine handles success/failure RNG.

### 5.3 Battle Flow

Each turn follows this sequence:

1. Player selects a move
2. Move is submitted to the LocalBattleEngine
3. The `@pkmn/sim` engine processes the turn (both player and AI opponent)
4. Protocol messages stream back through `use-battle.ts`
5. Messages are queued and displayed one at a time in the text box
6. Each message can trigger:
   - HP bar animation (smooth decrement)
   - Attack animation (sprite translates toward opponent)
   - Shake animation (sprite shakes on hit)
   - Sound effects (move SFX via base move mapping)
7. Player taps to advance each message

### 5.4 Status Effects

Pokemon Showdown status conditions are translated to pub-themed messages:

- Burn -> "is hung over!"
- Paralyze -> "is hammered!"
- Freeze -> "is too cold to move!"
- Cure -> "sobered up!"

### 5.5 Battle Outcomes

**Victory (faint opponent):**

1. "VICTORY!" overlay appears
2. Machine transitions to `resolvingBattle`
3. Server processes XP gain and potential badge award
4. Celebration sequence plays (see section 8)

**Catch (successful):**

1. Catch move succeeds in the sim
2. Machine transitions to `resolvingCatch`
3. Server adds the PubMon to the player's party (or PC if party full)
4. Celebration sequence plays with "GOTCHA!" screen

**Run (successful):**

1. Run move succeeds
2. Machine transitions to `resolvingRun`
3. Returns to crawl view

**Defeat (player faints):**

1. Player PubMon's HP reaches 0
2. Faint message displays
3. "DEFEATED..." overlay
4. Returns to crawl view

---

## 6. Team Management

Accessible via the "Team" tab in the bottom navbar.

### 6.1 Party Roster

Shows all caught PubMon (up to 6) in a scrollable list:

- 32px sprite in a type-colored box
- Name with "LEAD" badge if active
- Type badge and level
- Mini HP bar (3px, green/yellow/red based on percentage)
- HP numbers (current/max)

Empty party slots show dashed-border placeholders.

### 6.2 Pokemon Detail Panel

Tapping a PubMon in the roster reveals:

- Larger animated sprite (48px) in type-colored box
- Pokedex number, name, cry button, description
- Stats grid: HP, ATK, DEF, XP
- Moves grid: 2x2 layout showing all 4 moves

### 6.3 Set As Lead

The "SET AS LEAD" button sends `SET_ACTIVE_MON` to the machine. The lead PubMon is the one that enters battle first.

### 6.4 Play Mode (Physics Sandbox)

The "PLAY!" button opens a Matter.js physics sandbox as an overlay:

- The selected PubMon renders as a large 192px sprite with a physics body
- Hitbox is auto-generated from non-transparent sprite pixels
- Three states:
  - **Walking**: PubMon paces left-right, randomly jumps every 5-6 seconds
  - **Grabbed**: User drags the PubMon around, cry plays on slow movement
  - **Free**: After being thrown, PubMon tumbles with physics until settling
- A pokeball in the top-right corner exits play mode (opens when hovered)
- On mobile: device accelerometer controls gravity, shaking triggers free mode

---

## 7. Gym Progression & Badges

### 7.1 The Gym System

There are 10 gyms, each themed around a drink type and run by a named leader. Gyms are controlled globally by the admin (who sets the "current gym" based on which real-world pub the crawl is visiting).

| #  | Gym Name         | Type     | Leader   | Drinks Required |
|----|------------------|----------|----------|-----------------|
| 1  | The Frothy Mug   | Beer     | BROCK    | 1               |
| 2  | Ember Shots      | Shot     | BLAZE    | 1               |
| 3  | Rosegarden       | Wine     | ERIKA   | 1               |
| 4  | Clear Springs    | Water    | MISTY    | 1               |
| 5  | The Shaker       | Cocktail | MIXIE    | 1               |
| 6  | Barrel & Cask    | Beer     | BRUCE    | 2               |
| 7  | Inferno Lounge   | Shot     | LT. SURGE | 2             |
| 8  | Chateau Violet   | Wine     | VIOLET   | 2               |
| 9  | Tidal Tavern     | Water    | MARINA   | 2               |
| 10 | Botanica         | Cocktail | FLORA    | 2               |

### 7.2 Earning Badges

When the player wins a battle at the current gym's type:

1. Server checks if the player has ordered enough drinks of the gym's type
2. If requirements met, the gym's badge is awarded
3. Badge celebration screen plays (3D badge component)
4. Badge appears in the player's league view and trainer card

### 7.3 League View

The "League" tab shows the player's badge collection and gym trail. Gyms are displayed in a collapsible list showing completion status.

---

## 8. Celebration Sequences

After significant events, the game plays celebration screens in sequence. The player taps "CONTINUE" to advance through each.

### 8.1 Caught Celebration

- "GOTCHA!" header
- Captured PubMon sprite and name
- Description text
- Added to party notification

### 8.2 XP Gain

- "VICTORY!" header
- XP amount earned
- Level-up notification if applicable

### 8.3 Badge Reward

- 3D badge component renders with the earned badge
- Badge name and gym name displayed
- Celebration effects

---

## 9. Tournament (Multiplayer)

The Master Tournament is the competitive endgame, using live P2P battles.

### 9.1 Opt-In

After earning enough badges, the player can opt into the tournament from the League view. This sends `opt_in_tournament` to the server.

### 9.2 Tournament Start

The admin triggers the tournament via the admin dashboard (`admin_start_tournament`). The server:

1. Generates a bracket from all opted-in players
2. Assigns BYEs for odd numbers
3. Broadcasts `tournament_start` with the initial bracket
4. All clients receive the bracket and transition to the tournament view

### 9.3 Bracket View

The tournament view shows:

- **Your Match**: Highlighted matchup showing you and your opponent, with win/loss/waiting status
- **Full Bracket**: All matches listed with player names and statuses
- Color coding: green (won), red (lost), yellow (in progress), gray (waiting/forfeited)

### 9.4 P2P Battle

When a match is scheduled, the server sends `MATCH_STARTED`. Both players:

1. Create a **RemoteBattleEngine** connected to a dedicated **BattleServer** room
2. Both send `battle_join` to the BattleServer
3. BattleServer fetches both teams from MainEventServer
4. Battle proceeds with the same UI as wild encounters, but:
   - No CATCH or RUN options
   - BattleServer is the canonical authority (not local sim)
   - Local engine runs optimistic prediction for responsive animations
   - Server events reconcile with predictions; desync triggers rollback

### 9.5 Desync Handling

The RemoteBattleEngine detects desync by comparing predicted protocol events against server-canonical events:

1. Mismatch detected -> destroy local sim, create fresh Battle instance
2. Replay full server event log through the new instance
3. If reconciliation fails 3 times -> force resync (nuclear option)

### 9.6 Advancement

The admin can promote winners (`admin_promote_player`) or kick disconnected players (`admin_kick_player`). The bracket updates broadcast to all clients.

---

## 10. Hall of Fame

The endgame trophy room, triggered by the admin after the tournament concludes.

### 10.1 Triggering

Admin sends `admin_trigger_hall_of_fame`. Server broadcasts `hall_of_fame_ready`.

### 10.2 Display

- Pulsing title: "HALL OF FAME"
- Player cards sorted by ribbon count (highest first)
- Each card shows: avatar, name, ribbon count, ribbon images (32x32 pixel art)
- Current player's card highlighted with a darker "battle" variant box

### 10.3 Ribbons

Special awards assigned by the admin via `admin_assign_ribbon`. These represent achievements like tournament champion, most catches, best team, etc.

---

## 11. Pokedex

The "Pokedex" tab shows all 151 PubMon species. Each entry displays:

- Pokedex number
- Name and type
- Seen/caught status
- Sprite (if caught)

The pokedex completion count appears on the trainer card stats.

---

## 12. Admin Dashboard

The admin panel (`/admin`) controls the live event. Requires an admin secret (stored in localStorage after first entry).

### Capabilities

- **Gym Control**: Set the active gym for all players (broadcasts `gym_update`)
- **Tournament**: Start tournament, view bracket, promote/kick players
- **Hall of Fame**: Assign ribbons, trigger the ceremony
- **Leaderboard**: View all players' stats (drinks, badges, tournament status)
- **Debug**: Dump full server state as JSON

The admin is typically the pub crawl organizer, advancing gyms as the group moves between pubs.

---

## 13. Audio Design

### Background Music

- **Route music**: Plays during crawl, team, pokedex, league views
- **Battle music**: Plays during all battles (wild and tournament)
- **Victory music**: Plays on battle win

Track changes use volume ducking for smooth transitions.

### Sound Effects

- **Cries**: Each PubMon has a unique cry (mapped to Pokemon cries 001-151)
- **Move SFX**: Themed move names map to Gen 1 base moves, which map to attack sound effects
- **UI sounds**: Menu selections, transitions

---

## 14. Real-World Event Flow

A typical PubMon pub crawl session:

1. **Setup**: Admin deploys server, shares game URL
2. **Arrival at Pub 1**: Admin sets Gym 1 active. Players create characters, pick starters
3. **Ordering drinks**: Players order real drinks, log them in-game by type. Each order triggers a wild encounter
4. **Battling**: Players fight wild PubMon, catch new ones, build their party
5. **Moving pubs**: Admin advances to next gym. Players continue catching and battling
6. **Badge collection**: Players earn badges by winning battles at each gym's specialty type
7. **Tournament**: After visiting enough pubs, admin starts the Master Tournament
8. **P2P battles**: Players face off in live bracket matches
9. **Hall of Fame**: Admin awards ribbons and triggers the ceremony
10. **Champions crowned**: Top players celebrated on everyone's screens
