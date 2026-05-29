# Tournament Battle Flow

## Overview
This document explains how players are notified of matches and join P2P battles in the tournament system.

## Complete Flow

### 1. Match Creation (Server-side)
When a tournament round starts, `MainEventServer.startRoundMatches()`:

1. Creates a unique `battleId` for each match
2. Sets match status to `"in_progress"`
3. **Sets player state fields**:
   ```typescript
   player1.activeBattleId = battleId;
   player1.activeBattleOpponent = player2.info.name;
   player2.activeBattleId = battleId;
   player2.activeBattleOpponent = player1.info.name;
   ```
4. Sends individual `match_start` messages to each player with their opponent's name

**Message sent to Player 1:**
```json
{
  "type": "match_start",
  "battleId": "battle_match1_1234567890",
  "opponentName": "Player2Name"
}
```

**Message sent to Player 2:**
```json
{
  "type": "match_start",
  "battleId": "battle_match1_1234567890",
  "opponentName": "Player1Name"
}
```

### 2. Initial Connection / Reconnection
When a player connects (or reconnects), they receive a `player_state` message that includes:

```json
{
  "type": "player_state",
  "playerState": {
    "sessionId": "...",
    "info": { "name": "..." },
    "party": [...],
    "activeBattleId": "battle_match1_1234567890",  // Present if in active match
    "activeBattleOpponent": "OpponentName"         // Present if in active match
    // ... other fields
  }
}
```

### 3. Client-Side Handling (game-shell.tsx)

**On `player_state` message:**
```typescript
if (msg.type === "player_state" && msg.playerState) {
  send({ type: "PLAYER_STATE_UPDATE", playerState: msg.playerState });

  // Check for active battle (reconnection scenario)
  if (msg.playerState.activeBattleId && msg.playerState.activeBattleOpponent) {
    send({
      type: "MATCH_STARTED",
      battleId: msg.playerState.activeBattleId,
      opponentName: msg.playerState.activeBattleOpponent
    });
  }
}
```

**On `match_start` message:**
```typescript
if (msg.type === "match_start") {
  send({
    type: "MATCH_STARTED",
    battleId: msg.battleId,
    opponentName: msg.opponentName
  });
}
```

### 4. State Machine Transition (pubmon-machine.ts)

When `MATCH_STARTED` event is received:

```typescript
tournament: {
  initial: 'bracketView',
  states: {
    bracketView: {
      on: {
        MATCH_STARTED: {
          target: 'tournamentBattle',
          actions: assign({
            tournamentState: ({ context, event }) => ({
              ...context.tournamentState,
              activeBattle: {
                battleId: event.battleId,
                opponentName: event.opponentName,
              },
            }),
          }),
        },
      },
    },
    tournamentBattle: {
      // Player is now in battle
    },
  },
}
```

### 5. Battle Screen Rendering (game-shell.tsx)

When state matches `tournament.tournamentBattle`:

```tsx
{isTournamentBattle && context.tournamentState.activeBattle && activePokemon && (
  <BattleScreen
    wildPokemon={activePokemon} // Placeholder
    playerPokemon={activePokemon}
    onFight={() => {}}
    onCatch={() => {}} // No catch in tournament
    onRun={() => {}} // No run in tournament
    onBattleEnd={(result) => {
      send({ type: "FAINT_DETECTED", result: result === "win" ? "win" : "loss" });
    }}
    battleMode="p2p"
    battleId={context.tournamentState.activeBattle.battleId}
    socket={socket}
    sessionId={sessionId}
  />
)}
```

### 6. Battle Execution

The `BattleScreen` component:
1. Creates a `RemoteBattleEngine` with the `battleId`, `socket`, and `sessionId`
2. Sends `battle_join` message to BattleServer
3. BattleServer waits for both players to join
4. Once both joined, BattleServer initializes @pkmn/sim and starts the battle
5. Players submit moves through `RemoteBattleEngine.submitMove()`
6. BattleServer broadcasts `battle_update` messages with protocol events
7. Client renders battle animations based on events

### 7. Battle Completion

When battle ends:
1. BattleServer sends `battle_end` message to both players
2. BattleServer calls MainEventServer's `/rpc/battle-complete` endpoint
3. MainEventServer's `completeBattleMatch()`:
   - Sets `match.winnerId` and `match.status = "completed"`
   - **Clears player state fields**:
     ```typescript
     player1.activeBattleId = undefined;
     player1.activeBattleOpponent = undefined;
     player2.activeBattleId = undefined;
     player2.activeBattleOpponent = undefined;
     ```
   - Broadcasts `match_complete` message
   - Checks if round is complete
   - If all matches done, generates next round bracket

## Key Features

### Automatic Join
- No manual "Join Battle" button needed
- Server automatically transitions player to battle when match starts
- Works on reconnection (player rejoins their active battle)

### Reconnection Support
- If player refreshes during tournament, `activeBattleId` persists in server state
- On reconnection, client automatically sends `MATCH_STARTED` event
- Player rejoins their active battle seamlessly

### State Consistency
- Server is source of truth for active battles
- `activeBattleId` and `activeBattleOpponent` fields ensure consistency
- Fields cleared when match completes

## Testing Checklist

- [ ] Player receives `match_start` when tournament round begins
- [ ] Player automatically transitions to battle screen
- [ ] Player can see opponent's name
- [ ] Both players can submit moves
- [ ] Battle progresses with @pkmn/sim engine
- [ ] Winner is determined correctly
- [ ] Players return to bracket view after battle
- [ ] Player can refresh mid-battle and rejoin
- [ ] `activeBattleId` is cleared after match completes
- [ ] Next round generates correctly after all matches complete
