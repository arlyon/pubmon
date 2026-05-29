# PubMon Server Architecture

## PartyServer State Management

### How State Updates Work

PartyServer's `Server` class extends Cloudflare's `DurableObject`, giving you access to:

#### 1. **Storage API** (`this.ctx.storage`)
Transactional key-value storage that persists across server restarts:

```typescript
// Read from storage
const data = await this.ctx.storage.get<MyType>("key");

// Write to storage
await this.ctx.storage.put("key", value);

// Delete from storage
await this.ctx.storage.delete("key");

// Multiple operations (atomic transaction)
await this.ctx.storage.transaction(async (txn) => {
  await txn.put("key1", value1);
  await txn.put("key2", value2);
});
```

#### 2. **Environment Access** (`this.env`)
Access to environment variables and Durable Object bindings:

```typescript
const adminSecret = this.env.ADMIN_SECRET;
const otherDO = this.env.SOME_DO_NAMESPACE;
```

#### 3. **Server Identity** (`this.name`)
The unique identifier for this Durable Object instance:

```typescript
console.log(this.name); // e.g., "global" or "battle_123"
```

#### 4. **Built-in Methods**

```typescript
// Broadcasting
this.broadcast(message, excludeIds?) // Send to all connections

// Connection management
this.getConnection(id) // Get specific connection
this.getConnections(tag?) // Get all or filtered connections
```

### Lifecycle Hooks

```typescript
class MyServer extends Server {
  // 1. Called when DO starts or wakes from hibernation
  async onStart() {
    const state = await this.ctx.storage.get("state");
    // Initialize in-memory state from storage
  }

  // 2. Called when client connects
  async onConnect(connection: Connection) {
    console.log(`Client ${connection.id} connected`);
  }

  // 3. Called when message received
  // IMPORTANT: Signature is (connection, message), not (message, connection)!
  async onMessage(connection: Connection, message: string | ArrayBuffer) {
    const msg = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);

    // Handle message, update state
    await this.ctx.storage.put("state", newState);
  }

  // 4. Called when client disconnects
  async onClose(connection: Connection) {
    console.log(`Client ${connection.id} disconnected`);
  }
}
```

## PubMon Dual-Room Architecture

### Main Event Server (Global State)

**Responsibilities:**
- Session management (UUID-based authentication)
- Player Pokedex and Party persistence
- Drink logging and RNG encounters
- Global gym broadcasting
- Tournament bracket management

**State Storage:**
```typescript
interface GameState {
  phase: "collection" | "tournament";
  currentGymId: number;
  players: Map<string, PlayerState>;
  tournamentBracket?: TournamentBracket;
}

// Serialization for storage (Maps → Objects, Sets → Arrays)
async persistState() {
  const serializable = serializeGameState(this.gameState);
  await this.ctx.storage.put("gameState", serializable);
}

async onStart() {
  const stored = await this.ctx.storage.get<SerializableGameState>("gameState");
  if (stored) {
    this.gameState = deserializeGameState(stored);
  }
}
```

### Battle Server (Isolated Matches)

**Responsibilities:**
- 1v1 turn-based combat
- Strict turn validation
- Damage calculation
- Result reporting to Main Event Server

**State Storage:**
```typescript
interface BattleState {
  battleId: string;
  player1: BattlePlayer;
  player2: BattlePlayer;
  currentTurn: "player1" | "player2";
  status: "waiting" | "active" | "completed";
}

// Battle state is ephemeral (in-memory only)
// Results are reported back to MainEventServer for persistence
```

## Communication Patterns

### Client → Server
```typescript
// Client sends
ws.send(JSON.stringify({
  type: "order_drink",
  sessionId: "uuid-1234",
  drinkType: "beer"
}));

// Server receives
async onMessage(connection: Connection, message: string | ArrayBuffer) {
  const msg = JSON.parse(message);
  // Handle message
  await this.ctx.storage.put("players", updatedPlayers);
  connection.send(JSON.stringify(response));
}
```

### Server → Client
```typescript
// Send to specific client
connection.send(JSON.stringify({
  type: "encounter_result",
  wildPubmon: { ... }
}));

// Broadcast to all clients
this.broadcast(JSON.stringify({
  type: "gym_update",
  currentGymId: 2
}));
```

### Inter-Server Communication (Battle ↔ Main Event)

Battle Server fetches player data:
```typescript
const response = await fetch(
  `${this.env.PARTYKIT_URL}/parties/main/global/rpc/player/${sessionId}`
);
```

Battle Server reports results:
```typescript
await fetch(
  `${this.env.PARTYKIT_URL}/parties/main/global/rpc/battle-complete`,
  {
    method: "POST",
    body: JSON.stringify({ battleId, winnerId })
  }
);
```

## Best Practices

### ✅ DO:
- Store all persistent data via `this.ctx.storage.put()`
- Load state in `onStart()` (called after hibernation)
- Serialize complex types (Maps, Sets) before storage
- Use `this.broadcast()` for fan-out messages
- Handle both string and ArrayBuffer messages

### ❌ DON'T:
- Rely solely on in-memory state (will be lost on hibernation)
- Use `this.party` (doesn't exist!)
- Forget to serialize Sets/Maps before storage
- Store large objects (>128KB per key)
- Make assumptions about message order

## Storage Limits

- **Max key size:** 2KB
- **Max value size:** 128KB
- **Max keys per DO:** Unlimited
- **Max total storage:** 50GB per account

For larger data, consider using [SQLite-backed Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/) via `this.sql()`.

## Running the Server

```bash
# Development (local)
pnpm run server:dev

# Deploy to Cloudflare
pnpm run server:deploy

# View logs
pnpm run server:tail
```

## Sources
- [PartyServer npm](https://www.npmjs.com/package/partyserver)
- [PartyServer API Blog](https://blog.partykit.io/posts/partyserver-api/)
- [Cloudflare Durable Objects Storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)
- [Rethinking State at the Edge](https://lord.technology/2026/01/12/rethinking-state-at-the-edge-with-cloudflare-durable-objects.html)
