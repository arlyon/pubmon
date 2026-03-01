import type { PubMon, PubType } from "../../lib/pokemon-data";

// ============================================================================
// Player & Session State
// ============================================================================

export interface PlayerInfo {
  name: string;
  sprite: string;
}

export interface BattleLogEntry {
  pokemon: PubMon;
  startTime: number;
  endTime: number;
  outcome: "win" | "caught" | "run" | "lose";
}

export interface PlayerState {
  sessionId: string;
  info: PlayerInfo;
  party: PubMon[];
  activeIndex: number;
  badges: Set<number>;
  battleLog: BattleLogEntry[];
  tournamentOptIn: boolean;
  ribbons: string[]; // Ribbon sprite paths earned by player
  createdAt: number;
  lastActivity: number;
}

// ============================================================================
// Global Game State (Main Event Server)
// ============================================================================

export interface GameState {
  phase: "collection" | "tournament" | "hall-of-fame";
  currentGymId: number; // Admin-controlled global gym
  players: Map<string, PlayerState>; // sessionId -> PlayerState
  tournamentBracket?: TournamentBracket;
  hallOfFame?: Record<string, string[]>; // sessionId -> ribbon paths
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
  player2SessionId: string | null; // null for bye matches
  battleId?: string; // Generated when battle starts
  winnerId?: string; // Set when battle completes
  status: "pending" | "in_progress" | "completed" | "forfeited";
  adminOverride?: boolean; // True if admin manually advanced a player
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
  party: PubMon[];
  activeIndex: number;
  badges: number[];
  battleLog: BattleLogEntry[];
  tournamentOptIn: boolean;
  ribbons: string[];
  createdAt: number;
  lastActivity: number;
}

export interface SerializableGameState {
  phase: "collection" | "tournament" | "hall-of-fame";
  currentGymId: number;
  players: Record<string, SerializablePlayerState>;
  tournamentBracket?: TournamentBracket;
  hallOfFame?: Record<string, string[]>;
}

// ============================================================================
// Utility functions for serialization
// ============================================================================

export function serializePlayerState(state: PlayerState): SerializablePlayerState {
  return {
    ...state,
    badges: Array.from(state.badges),
    battleLog: state.battleLog,
    ribbons: state.ribbons || [],
  };
}

export function deserializePlayerState(state: SerializablePlayerState): PlayerState {
  return {
    ...state,
    badges: new Set(state.badges),
    battleLog: state.battleLog || [], // Handle legacy players without battleLog
    ribbons: state.ribbons || [], // Handle legacy players without ribbons
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
    hallOfFame: state.hallOfFame,
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
    hallOfFame: state.hallOfFame,
  };
}
