import type { PubMon, PubType } from "../../lib/pokemon-data";

// ============================================================================
// Player & Session State
// ============================================================================

export interface PlayerInfo {
  name: string;
  sprite: string;
}

export interface PlayerState {
  sessionId: string;
  info: PlayerInfo;
  pokedex: {
    seen: Set<number>;
    caught: Set<number>;
  };
  party: PubMon[];
  activeIndex: number;
  badges: Set<number>;
  drinksLogged: number;
  tournamentOptIn: boolean;
  createdAt: number;
  lastActivity: number;
}

// ============================================================================
// Global Game State (Main Event Server)
// ============================================================================

export interface GameState {
  phase: "collection" | "tournament";
  currentGymId: number; // Admin-controlled global gym
  players: Map<string, PlayerState>; // sessionId -> PlayerState
  tournamentBracket?: TournamentBracket;
}

// ============================================================================
// Tournament State
// ============================================================================

export interface TournamentBracket {
  round: number;
  matches: TournamentMatch[];
}

export interface TournamentMatch {
  matchId: string;
  player1SessionId: string;
  player2SessionId: string;
  battleId?: string; // Generated when battle starts
  winnerId?: string; // Set when battle completes
  status: "pending" | "in_progress" | "completed";
}

// ============================================================================
// Battle State (Battle Server)
// ============================================================================

export interface BattleState {
  battleId: string;
  player1: BattlePlayer;
  player2: BattlePlayer;
  currentTurn: "player1" | "player2";
  turnCount: number;
  status: "waiting" | "active" | "completed";
  winnerId?: string;
}

export interface BattlePlayer {
  sessionId: string;
  name: string;
  party: PubMon[];
  activeIndex: number;
  connected: boolean;
}

// ============================================================================
// Serializable versions for storage (Sets converted to arrays)
// ============================================================================

export interface SerializablePlayerState {
  sessionId: string;
  info: PlayerInfo;
  pokedex: {
    seen: number[];
    caught: number[];
  };
  party: PubMon[];
  activeIndex: number;
  badges: number[];
  drinksLogged: number;
  tournamentOptIn: boolean;
  createdAt: number;
  lastActivity: number;
}

export interface SerializableGameState {
  phase: "collection" | "tournament";
  currentGymId: number;
  players: Record<string, SerializablePlayerState>;
  tournamentBracket?: TournamentBracket;
}

// ============================================================================
// Utility functions for serialization
// ============================================================================

export function serializePlayerState(state: PlayerState): SerializablePlayerState {
  return {
    ...state,
    pokedex: {
      seen: Array.from(state.pokedex.seen),
      caught: Array.from(state.pokedex.caught),
    },
    badges: Array.from(state.badges),
  };
}

export function deserializePlayerState(state: SerializablePlayerState): PlayerState {
  return {
    ...state,
    pokedex: {
      seen: new Set(state.pokedex.seen),
      caught: new Set(state.pokedex.caught),
    },
    badges: new Set(state.badges),
  };
}

export function serializeGameState(state: GameState): SerializableGameState {
  const players: Record<string, SerializablePlayerState> = {};
  state.players.forEach((player, sessionId) => {
    players[sessionId] = serializePlayerState(player);
  });

  return {
    phase: state.phase,
    currentGymId: state.currentGymId,
    players,
    tournamentBracket: state.tournamentBracket,
  };
}

export function deserializeGameState(state: SerializableGameState): GameState {
  const players = new Map<string, PlayerState>();
  Object.entries(state.players).forEach(([sessionId, playerState]) => {
    players.set(sessionId, deserializePlayerState(playerState));
  });

  return {
    phase: state.phase,
    currentGymId: state.currentGymId,
    players,
    tournamentBracket: state.tournamentBracket,
  };
}
