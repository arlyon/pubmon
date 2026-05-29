import type { PubMon, PubType } from "../../lib/pokemon-data";
import type { PlayerInfo, PlayerState, TournamentBracket } from "./game-state";

// ============================================================================
// Client -> Server Messages (Main Event Server)
// ============================================================================

export type ClientMessage =
	| CreatePlayerMessage
	| CheckSessionMessage
	| CheckNameMessage
	| ClaimPlayerMessage
	| OrderDrinkMessage
	| CatchAttemptMessage
	| FightMessage
	| RunMessage
	| SelectStarterMessage
	| UpdatePartyMessage
	| SetActiveMonMessage
	| OptInTournamentMessage
	// Admin messages
	| AdminSetGymMessage
	| AdminStartTournamentMessage
	| AdminResetTournamentMessage
	| AdminResolveMatchMessage
	| AdminForfeitMatchMessage
	| AdminPromotePlayerMessage
	| AdminKickPlayerMessage
	| AdminReaddPlayerMessage
	| AdminAssignRibbonMessage
	| AdminTriggerHallOfFameMessage
	| AdminRequestStateMessage;

export interface CreatePlayerMessage {
	type: "create_player";
	sessionId: string;
	playerInfo: PlayerInfo;
}

export interface CheckSessionMessage {
	type: "check_session";
	sessionId: string;
}

export interface CheckNameMessage {
	type: "check_name";
	name: string;
}

export interface ClaimPlayerMessage {
	type: "claim_player";
	name: string;
	newSessionId: string;
}

export interface OrderDrinkMessage {
	type: "order_drink";
	sessionId: string;
	drinkType: PubType;
}

export interface CatchAttemptMessage {
	type: "catch_attempt";
	sessionId: string;
	pubmonId: number;
	battleStartTime: number;
	battleEndTime: number;
}

export interface FightMessage {
	type: "fight";
	sessionId: string;
	pubmonId: number; // ID of wild PubMon being fought
	battleStartTime: number;
	battleEndTime: number;
	outcome: "win" | "lose";
}

export interface RunMessage {
	type: "run";
	sessionId: string;
	pubmonId: number;
	battleStartTime: number;
	battleEndTime: number;
}

export interface SelectStarterMessage {
	type: "select_starter";
	sessionId: string;
	pubmonId: number;
}

export interface UpdatePartyMessage {
	type: "update_party";
	sessionId: string;
	party: PubMon[];
}

export interface SetActiveMonMessage {
	type: "set_active_mon";
	sessionId: string;
	activeIndex: number;
}

export interface OptInTournamentMessage {
	type: "opt_in_tournament";
	sessionId: string;
	optIn: boolean;
}

// Admin messages
export interface AdminSetGymMessage {
	type: "admin_set_gym";
	adminSecret: string;
	gymId: number;
}

export interface AdminStartTournamentMessage {
	type: "admin_start_tournament";
	adminSecret: string;
}

export interface AdminResetTournamentMessage {
	type: "admin_reset_tournament";
	adminSecret: string;
}

export interface AdminResolveMatchMessage {
	type: "admin_resolve_match";
	adminSecret: string;
	matchId: string;
	winnerId: string | null; // sessionId of winner, or null to void (no winner)
}

export interface AdminForfeitMatchMessage {
	type: "admin_forfeit_match";
	adminSecret: string;
	battleId: string;
	forfeitSessionId: string;
}

export interface AdminPromotePlayerMessage {
	type: "admin_promote_player";
	adminSecret: string;
	matchId: string;
	sessionId: string; // Player to promote
}

export interface AdminKickPlayerMessage {
	type: "admin_kick_player";
	adminSecret: string;
	matchId: string;
	sessionId: string; // Player to kick
}

export interface AdminReaddPlayerMessage {
	type: "admin_readd_player";
	adminSecret: string;
	sessionId: string; // Player to re-add to bracket
}

export interface AdminAssignRibbonMessage {
	type: "admin_assign_ribbon";
	adminSecret: string;
	sessionId: string;
	ribbonPath: string; // Path to ribbon sprite
}

export interface AdminTriggerHallOfFameMessage {
	type: "admin_trigger_hall_of_fame";
	adminSecret: string;
}

export interface AdminRequestStateMessage {
	type: "admin_request_state";
	adminSecret: string;
}

// ============================================================================
// Server -> Client Messages (Main Event Server)
// ============================================================================

export type ServerMessage =
	| PlayerCreatedMessage
	| NameStatusMessage
	| EncounterResultMessage
	| CatchResultMessage
	| FightResultMessage
	| StarterSelectedMessage
	| PlayerStateMessage
	| GymUpdateMessage
	| LeaderboardSyncMessage
	| TournamentStartMessage
	| MatchStartMessage
	| MatchCompleteMessage
	| BracketUpdateMessage
	| HallOfFameReadyMessage
	| AdminStateMessage
	| ErrorMessage;

export interface PlayerCreatedMessage {
	type: "player_created";
	sessionId: string;
	playerState: PlayerState;
}

export interface NameStatusMessage {
	type: "name_status";
	available: boolean;
	name?: string;
}

export interface EncounterResultMessage {
	type: "encounter_result";
	wildPubmon: PubMon;
}

export interface CatchResultMessage {
	type: "catch_result";
	success: boolean;
	pubmon?: PubMon;
	reason?: string;
}

export interface FightResultMessage {
	type: "fight_result";
	xpGained: number;
	updatedParty: PubMon[];
	awardedBadgeId?: number;
}

export interface StarterSelectedMessage {
	type: "starter_selected";
	starter: PubMon;
}

export interface PlayerStateMessage {
	type: "player_state";
	playerState: PlayerState;
}

export interface GymUpdateMessage {
	type: "gym_update";
	currentGymId: number;
	gamePhase: "collection" | "tournament" | "hall-of-fame";
}

export interface LeaderboardSyncMessage {
	type: "leaderboard_sync";
	players: Array<{
		sessionId: string;
		name: string;
		sprite: string;
		drinksLogged: number;
		battlesWon: number;
		totalBattles: number;
		badges: number[];
		partyCount: number;
		level: number;
		tournamentOptIn: boolean;
	}>;
}

export interface TournamentStartMessage {
	type: "tournament_start";
	bracket: TournamentBracket;
}

export interface MatchStartMessage {
	type: "match_start";
	battleId: string;
	player1SessionId: string;
	player1Name: string;
	player2SessionId: string;
	player2Name: string;
}

export interface MatchCompleteMessage {
	type: "match_complete";
	battleId: string;
	winnerId: string; // "" when the match was voided (no winner)
	winnerName: string;
	durationMs?: number; // total battle time, when reported by the BattleServer
	moveCount?: number;
}

export interface BracketUpdateMessage {
	type: "bracket_update";
	bracket: TournamentBracket;
}

export interface HallOfFameReadyMessage {
	type: "hall_of_fame_ready";
	hallOfFame: Record<string, string[]>; // sessionId -> ribbon paths
}

export interface AdminStateMessage {
	type: "admin_state";
	state: any; // Full serialized game state for debugging
}

export interface ErrorMessage {
	type: "error";
	message: string;
}

// ============================================================================
// Client -> Server Messages (Battle Server)
// ============================================================================

export type BattleClientMessage =
	| BattleJoinMessage
	| BattleAttackMessage
	| BattleSwitchMessage
	| BattleForfeitMessage;

export interface BattleJoinMessage {
	type: "battle_join";
	sessionId: string;
}

export interface BattleAttackMessage {
	type: "battle_attack";
	sessionId: string;
	moveIndex: number;
}

export interface BattleSwitchMessage {
	type: "battle_switch";
	sessionId: string;
	newActiveIndex: number;
}

export interface BattleForfeitMessage {
	type: "battle_forfeit";
	sessionId: string;
}

// ============================================================================
// Server -> Client Messages (Battle Server)
// ============================================================================

export type BattleServerMessage =
	| BattleStateMessage
	| BattleUpdateMessage
	| BattleTurnResultMessage
	| BattleEndMessage
	| BattleErrorMessage;

export interface BattleStateMessage {
	type: "battle_state";
	battleId: string;
	player1: {
		name: string;
		activePubmon: PubMon;
		partyCount: number;
	};
	player2: {
		name: string;
		activePubmon: PubMon;
		partyCount: number;
	};
	currentTurn: "player1" | "player2";
	turnCount: number;
	startedAt: number; // epoch ms the battle became active
	lastMoveAt: number; // epoch ms of the last accepted move
	serverNow: number; // server clock at send time (for client offset calc)
}

export interface BattleUpdateMessage {
	type: "battle_update";
	events: string[]; // Array of protocol strings
}

export interface BattleTurnResultMessage {
	type: "battle_turn_result";
	attacker: string;
	defender: string;
	move: string;
	damage: number;
	defenderHp: number;
	defenderMaxHp: number;
	fainted: boolean;
}

export interface BattleEndMessage {
	type: "battle_end";
	winnerId: string; // "" when voided (no winner)
	winnerName: string;
	reason?: "natural" | "admin" | "forfeit" | "void";
}

export interface BattleErrorMessage {
	type: "battle_error";
	message: string;
}
