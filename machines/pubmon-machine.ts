import { setup, assign, fromPromise, type ActorRefFrom } from 'xstate';
import type { PubMon, PubType } from '@/lib/pokemon-data';
import type { PlayerInfo } from '@/components/player-create';
import type { PartySocket } from 'partysocket';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LeaderboardEntry {
  name: string;
  drinksLogged: number;
  battlesWon: number;
  totalBattles: number;
  badges: number[];
  partyCount: number;
  level: number;
  tournamentOptIn?: boolean;
}

export interface TournamentBracket {
  matches: any[];
  currentRound: number;
}

export interface GameContext {
  socket: PartySocket;
  sessionId: string;
  playerInfo: PlayerInfo | null;
  party: PubMon[];
  activeIndex: number;
  badges: Set<number>;
  currentGymId: number;
  leaderboard: LeaderboardEntry[];
  activeEncounter: {
    wildPubmon: PubMon | null;
    battleStartTime: number | null;
  };
  tournamentState: {
    isOptedIn: boolean;
    bracket: TournamentBracket | null;
  };
  battleLog: Array<{
    pokemon: PubMon;
    startTime: number;
    endTime: number;
    outcome: 'win' | 'caught' | 'run' | 'lose';
  }>;
  // Temporary state for transitions
  xpGained: number;
  caughtPokemon: PubMon | null;
  awardedBadgeId: number | null;
}

export type GameEvent =
  // UI Events
  | { type: 'ORDER_DRINK'; drinkType: PubType }
  | { type: 'SELECT_STARTER'; pokemon: PubMon }
  | { type: 'ATTACK'; moveIdx: number }
  | { type: 'CATCH' }
  | { type: 'RUN' }
  | { type: 'FAINT_DETECTED'; result: 'win' | 'loss' }
  | { type: 'CONTINUE' }
  | { type: 'SET_ACTIVE_MON'; index: number }
  | { type: 'NAVIGATE'; phase: 'crawl' | 'team' | 'pokedex' | 'league' | 'tournament' | 'hall-of-fame' }
  | { type: 'PLAYER_CREATED'; playerInfo: PlayerInfo; existingState?: any }
  // Server Events (Background Sync)
  | { type: 'LEADERBOARD_SYNC'; players: LeaderboardEntry[] }
  | { type: 'GYM_UPDATE'; currentGymId: number }
  | { type: 'TOURNAMENT_STARTED'; bracket: TournamentBracket }
  | { type: 'BRACKET_UPDATE'; bracket: TournamentBracket }
  | { type: 'HALL_OF_FAME_READY' }
  | { type: 'PLAYER_STATE_UPDATE'; playerState: any }
  // Internal Events
  | { type: 'NEXT' }
  | { type: 'SELECT_GENDER'; gender: 'boy' | 'girl' }
  | { type: 'SUBMIT_NAME'; name: string }
  | { type: 'CONFIRM_NAME' }
  | { type: 'CLAIM_PLAYER'; name: string }
  | { type: 'REJECT_TAKEOVER' };

// ============================================================================
// WEBSOCKET HELPERS
// ============================================================================

/**
 * Waits for a specific WebSocket message type
 */
function waitForWebSocketMessage(
  socket: PartySocket,
  messageType: string,
  timeoutMs = 30000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', handler);
      reject(new Error(`Timeout waiting for ${messageType}`));
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === messageType) {
          clearTimeout(timeout);
          socket.removeEventListener('message', handler);
          resolve(msg);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    socket.addEventListener('message', handler);
  });
}

// ============================================================================
// XSTATE MACHINE SETUP
// ============================================================================

export const pubmonMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as {
      socket: PartySocket;
      initialPlayerState?: any;
      initialGymId?: number;
    },
  },

  actors: {
    // ========================================================================
    // ONBOARDING ACTORS
    // ========================================================================

    pickNameActor: fromPromise<any, { socket: PartySocket; sessionId: string; name: string }>(
      async ({ input }) => {
        const { socket, sessionId, name } = input;

        // Send check_name message
        socket.send(JSON.stringify({
          type: 'check_name',
          name: name.trim().toUpperCase(),
        }));

        // Wait for name_status response
        const response = await waitForWebSocketMessage(socket, 'name_status');
        return response;
      }
    ),

    createPlayerActor: fromPromise<any, { socket: PartySocket; sessionId: string; playerInfo: PlayerInfo }>(
      async ({ input }) => {
        const { socket, sessionId, playerInfo } = input;

        // Send create_player message
        socket.send(JSON.stringify({
          type: 'create_player',
          sessionId,
          playerInfo: {
            name: playerInfo.name.trim().toUpperCase(),
            sprite: playerInfo.gender === 'boy' ? 'boy' : 'girl',
          },
        }));

        // Wait for player_created or player_state
        const response = await Promise.race([
          waitForWebSocketMessage(socket, 'player_created'),
          waitForWebSocketMessage(socket, 'player_state'),
        ]);

        return response;
      }
    ),

    claimPlayerActor: fromPromise<any, { socket: PartySocket; sessionId: string; name: string }>(
      async ({ input }) => {
        const { socket, sessionId, name } = input;

        // Send claim_player message
        socket.send(JSON.stringify({
          type: 'claim_player',
          name: name.trim().toUpperCase(),
          newSessionId: sessionId,
        }));

        // Wait for player_state response
        const response = await waitForWebSocketMessage(socket, 'player_state');
        return response;
      }
    ),

    pickPokemonActor: fromPromise<any, { socket: PartySocket; sessionId: string; pubmonId: number }>(
      async ({ input }) => {
        const { socket, sessionId, pubmonId } = input;

        // Send select_starter message
        socket.send(JSON.stringify({
          type: 'select_starter',
          sessionId,
          pubmonId,
        }));

        // Wait for starter_selected and player_state
        await waitForWebSocketMessage(socket, 'starter_selected');
        const playerState = await waitForWebSocketMessage(socket, 'player_state');

        return playerState;
      }
    ),

    // ========================================================================
    // BATTLE ACTORS
    // ========================================================================

    encounterActor: fromPromise<any, { socket: PartySocket; sessionId: string; drinkType: PubType }>(
      async ({ input }) => {
        const { socket, sessionId, drinkType } = input;

        // Send order_drink message
        socket.send(JSON.stringify({
          type: 'order_drink',
          sessionId,
          drinkType,
        }));

        // Wait for encounter_result
        const response = await waitForWebSocketMessage(socket, 'encounter_result');
        return response;
      }
    ),

    catchActor: fromPromise<any, {
      socket: PartySocket;
      sessionId: string;
      pubmonId: number;
      battleStartTime: number;
    }>(
      async ({ input }) => {
        const { socket, sessionId, pubmonId, battleStartTime } = input;

        const battleEndTime = Date.now();

        // Send catch_attempt message
        socket.send(JSON.stringify({
          type: 'catch_attempt',
          sessionId,
          pubmonId,
          battleStartTime,
          battleEndTime,
        }));

        // Wait for catch_result
        const response = await waitForWebSocketMessage(socket, 'catch_result');
        return response;
      }
    ),

    runActor: fromPromise<any, {
      socket: PartySocket;
      sessionId: string;
      pubmonId: number;
      battleStartTime: number;
    }>(
      async ({ input }) => {
        const { socket, sessionId, pubmonId, battleStartTime } = input;

        const battleEndTime = Date.now();

        // Send run message
        socket.send(JSON.stringify({
          type: 'run',
          sessionId,
          pubmonId,
          battleStartTime,
          battleEndTime,
        }));

        // Wait for player_state confirmation
        const response = await waitForWebSocketMessage(socket, 'player_state');
        return response;
      }
    ),

    battleResolutionActor: fromPromise<any, {
      socket: PartySocket;
      sessionId: string;
      pubmonId: number;
      battleStartTime: number;
      outcome: 'win' | 'lose';
    }>(
      async ({ input }) => {
        const { socket, sessionId, pubmonId, battleStartTime, outcome } = input;

        const battleEndTime = Date.now();

        // Send fight message
        socket.send(JSON.stringify({
          type: 'fight',
          sessionId,
          pubmonId,
          outcome,
          battleStartTime,
          battleEndTime,
        }));

        // Wait for fight_result (win) or player_state (loss)
        if (outcome === 'win') {
          const response = await waitForWebSocketMessage(socket, 'fight_result');
          return response;
        } else {
          const response = await waitForWebSocketMessage(socket, 'player_state');
          return { outcome: 'loss', playerState: response };
        }
      }
    ),

    setActiveMonActor: fromPromise<any, {
      socket: PartySocket;
      sessionId: string;
      activeIndex: number;
    }>(
      async ({ input }) => {
        const { socket, sessionId, activeIndex } = input;

        // Send set_active_mon message
        socket.send(JSON.stringify({
          type: 'set_active_mon',
          sessionId,
          activeIndex,
        }));

        // Wait for player_state response
        const response = await waitForWebSocketMessage(socket, 'player_state');
        return response;
      }
    ),
  },

  actions: {
    updateLeaderboard: assign({
      leaderboard: ({ event }) => {
        if (event.type === 'LEADERBOARD_SYNC') {
          return event.players;
        }
        return [];
      },
    }),

    updateGym: assign({
      currentGymId: ({ event }) => {
        if (event.type === 'GYM_UPDATE') {
          return event.currentGymId;
        }
        return 1;
      },
    }),

    updateTournamentBracket: assign({
      tournamentState: ({ context, event }) => {
        if (event.type === 'TOURNAMENT_STARTED' || event.type === 'BRACKET_UPDATE') {
          return {
            ...context.tournamentState,
            bracket: event.bracket,
          };
        }
        return context.tournamentState;
      },
    }),

    updatePlayerState: assign({
      party: ({ event }) => {
        if (event.type === 'PLAYER_STATE_UPDATE' && event.playerState) {
          return event.playerState.party || [];
        }
        return [];
      },
      activeIndex: ({ event }) => {
        if (event.type === 'PLAYER_STATE_UPDATE' && event.playerState) {
          return event.playerState.activeIndex || 0;
        }
        return 0;
      },
      badges: ({ event }) => {
        if (event.type === 'PLAYER_STATE_UPDATE' && event.playerState) {
          return new Set(event.playerState.badges || []);
        }
        return new Set();
      },
      battleLog: ({ event }) => {
        if (event.type === 'PLAYER_STATE_UPDATE' && event.playerState) {
          return event.playerState.battleLog || [];
        }
        return [];
      },
      tournamentState: ({ context, event }) => {
        if (event.type === 'PLAYER_STATE_UPDATE' && event.playerState) {
          return {
            ...context.tournamentState,
            isOptedIn: event.playerState.tournamentOptIn || false,
          };
        }
        return context.tournamentState;
      },
    }),

    setEncounter: assign({
      activeEncounter: ({ event }) => {
        if (event.type === 'ORDER_DRINK') {
          return {
            wildPubmon: null,
            battleStartTime: Date.now(),
          };
        }
        return { wildPubmon: null, battleStartTime: null };
      },
    }),

    clearEncounter: assign({
      activeEncounter: {
        wildPubmon: null,
        battleStartTime: null,
      },
    }),

    setPlayerInfo: assign({
      playerInfo: ({ event }) => {
        if (event.type === 'PLAYER_CREATED') {
          return event.playerInfo;
        }
        return null;
      },
    }),

    restorePlayerState: assign({
      playerInfo: ({ event }) => {
        if (event.type === 'PLAYER_CREATED' && event.existingState) {
          return {
            name: event.existingState.info.name,
            gender: (event.existingState.info.sprite === 'boy' ? 'boy' : 'girl') as 'boy' | 'girl',
          };
        }
        return null;
      },
      party: ({ event }) => {
        if (event.type === 'PLAYER_CREATED' && event.existingState) {
          return event.existingState.party || [];
        }
        return [];
      },
      activeIndex: ({ event }) => {
        if (event.type === 'PLAYER_CREATED' && event.existingState) {
          return event.existingState.activeIndex || 0;
        }
        return 0;
      },
      badges: ({ event }) => {
        if (event.type === 'PLAYER_CREATED' && event.existingState) {
          return new Set(event.existingState.badges || []);
        }
        return new Set();
      },
      battleLog: ({ event }) => {
        if (event.type === 'PLAYER_CREATED' && event.existingState) {
          return event.existingState.battleLog || [];
        }
        return [];
      },
    }),
  },

  guards: {
    hasParty: ({ context }) => context.party.length > 0,
    hasNoBadge: ({ context, event }) => {
      if (event.type === 'FAINT_DETECTED') {
        // Check if we won and got a badge
        return true; // We'll check in the next state
      }
      return false;
    },
  },
}).createMachine({
  id: 'pubmon',
  type: 'parallel',
  context: ({ input }) => ({
    socket: input.socket,
    sessionId: '',
    playerInfo: input.initialPlayerState
      ? {
          name: input.initialPlayerState.info.name,
          gender: input.initialPlayerState.info.sprite === 'boy' ? 'boy' : 'girl',
        }
      : null,
    party: input.initialPlayerState?.party || [],
    activeIndex: input.initialPlayerState?.activeIndex || 0,
    badges: input.initialPlayerState ? new Set(input.initialPlayerState.badges) : new Set(),
    currentGymId: input.initialGymId || 1,
    leaderboard: [],
    activeEncounter: {
      wildPubmon: null,
      battleStartTime: null,
    },
    tournamentState: {
      isOptedIn: input.initialPlayerState?.tournamentOptIn || false,
      bracket: null,
    },
    battleLog: input.initialPlayerState?.battleLog || [],
    xpGained: 0,
    caughtPokemon: null,
    awardedBadgeId: null,
  }),

  states: {
    // ========================================================================
    // REGION 1: BACKGROUND SYNC
    // ========================================================================
    sync: {
      type: 'parallel',
      states: {
        listening: {
          on: {
            LEADERBOARD_SYNC: {
              actions: 'updateLeaderboard',
            },
            GYM_UPDATE: {
              actions: 'updateGym',
            },
            TOURNAMENT_STARTED: {
              actions: 'updateTournamentBracket',
            },
            BRACKET_UPDATE: {
              actions: 'updateTournamentBracket',
            },
            PLAYER_STATE_UPDATE: {
              actions: 'updatePlayerState',
            },
          },
        },
      },
    },

    // ========================================================================
    // REGION 2: VIEW (UI ROUTER)
    // ========================================================================
    view: {
      initial: 'initializing',
      states: {
        initializing: {
          always: [
            {
              guard: 'hasParty',
              target: 'mainLoop.crawl',
            },
            {
              target: 'onboarding.welcome',
            },
          ],
        },

        // ====================================================================
        // ONBOARDING
        // ====================================================================
        onboarding: {
          initial: 'welcome',
          on: {
            PLAYER_CREATED: [
              {
                guard: ({ event }) =>
                  event.type === 'PLAYER_CREATED' &&
                  event.existingState?.party?.length > 0,
                target: 'mainLoop.crawl',
                actions: 'restorePlayerState',
              },
              {
                target: '.starterSelect',
                actions: 'setPlayerInfo',
              },
            ],
          },
          states: {
            welcome: {
              on: {
                NEXT: 'genderSelect',
              },
            },

            genderSelect: {
              on: {
                SELECT_GENDER: 'nameInput',
              },
            },

            nameInput: {
              on: {
                SUBMIT_NAME: 'verifyingName',
              },
            },

            verifyingName: {
              invoke: {
                id: 'pickName',
                src: 'pickNameActor',
                input: ({ context, event }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  name: event.type === 'SUBMIT_NAME' ? event.name : '',
                }),
                onDone: [
                  {
                    guard: ({ event }) => event.output.available === true,
                    target: 'confirmName',
                  },
                  {
                    target: 'takeoverPrompt',
                  },
                ],
                onError: 'nameInput',
              },
            },

            confirmName: {
              on: {
                CONFIRM_NAME: 'creatingPlayer',
                REJECT_TAKEOVER: 'nameInput',
              },
            },

            takeoverPrompt: {
              on: {
                CLAIM_PLAYER: 'claimingPlayer',
                REJECT_TAKEOVER: 'nameInput',
              },
            },

            claimingPlayer: {
              invoke: {
                id: 'claimPlayer',
                src: 'claimPlayerActor',
                input: ({ context, event }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  name: event.type === 'CLAIM_PLAYER' ? event.name : '',
                }),
                onDone: {
                  target: '#pubmon.view.mainLoop.crawl',
                  actions: 'restorePlayerState',
                },
                onError: 'nameInput',
              },
            },

            creatingPlayer: {
              invoke: {
                id: 'createPlayer',
                src: 'createPlayerActor',
                input: ({ context }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  playerInfo: context.playerInfo!,
                }),
                onDone: {
                  target: 'starterSelect',
                  actions: 'setPlayerInfo',
                },
                onError: 'nameInput',
              },
            },

            starterSelect: {
              on: {
                SELECT_STARTER: 'selectingStarter',
              },
            },

            selectingStarter: {
              invoke: {
                id: 'pickStarter',
                src: 'pickPokemonActor',
                input: ({ context, event }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  pubmonId: event.type === 'SELECT_STARTER' ? event.pokemon.id : 0,
                }),
                onDone: {
                  target: '#pubmon.view.mainLoop.crawl',
                  actions: assign({
                    party: ({ event }) => event.output.playerState?.party || [],
                    activeIndex: 0,
                  }),
                },
                onError: 'starterSelect',
              },
            },
          },
        },

        // ====================================================================
        // MAIN LOOP
        // ====================================================================
        mainLoop: {
          initial: 'crawl',
          states: {
            crawl: {
              on: {
                ORDER_DRINK: {
                  target: 'resolvingEncounter',
                  actions: 'setEncounter',
                },
                NAVIGATE: [
                  { guard: ({ event }) => event.phase === 'team', target: 'team' },
                  { guard: ({ event }) => event.phase === 'pokedex', target: 'pokedex' },
                  { guard: ({ event }) => event.phase === 'league', target: 'league' },
                ],
              },
            },

            team: {
              on: {
                NAVIGATE: [
                  { guard: ({ event }) => event.phase === 'crawl', target: 'crawl' },
                  { guard: ({ event }) => event.phase === 'pokedex', target: 'pokedex' },
                  { guard: ({ event }) => event.phase === 'league', target: 'league' },
                ],
                SET_ACTIVE_MON: 'settingActiveMon',
              },
            },

            settingActiveMon: {
              invoke: {
                id: 'setActiveMon',
                src: 'setActiveMonActor',
                input: ({ context, event }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  activeIndex: event.type === 'SET_ACTIVE_MON' ? event.index : 0,
                }),
                onDone: {
                  target: 'team',
                  actions: assign({
                    activeIndex: ({ event }) => event.output.playerState?.activeIndex || 0,
                  }),
                },
                onError: 'team',
              },
            },

            pokedex: {
              on: {
                NAVIGATE: [
                  { guard: ({ event }) => event.phase === 'crawl', target: 'crawl' },
                  { guard: ({ event }) => event.phase === 'team', target: 'team' },
                  { guard: ({ event }) => event.phase === 'league', target: 'league' },
                ],
              },
            },

            league: {
              on: {
                NAVIGATE: [
                  { guard: ({ event }) => event.phase === 'crawl', target: 'crawl' },
                  { guard: ({ event }) => event.phase === 'team', target: 'team' },
                  { guard: ({ event }) => event.phase === 'pokedex', target: 'pokedex' },
                  { guard: ({ event }) => event.phase === 'tournament', target: 'tournament' },
                ],
              },
            },

            tournament: {
              initial: 'bracketView',
              states: {
                bracketView: {
                  on: {
                    // Match start will be triggered by server
                    NAVIGATE: {
                      guard: ({ event }) => event.phase === 'crawl',
                      target: '#pubmon.view.mainLoop.crawl',
                    },
                  },
                },

                tournamentBattle: {
                  // RUN and CATCH are intentionally omitted
                  on: {
                    FAINT_DETECTED: '#pubmon.view.mainLoop.resolvingBattle',
                  },
                },
              },
            },

            hallOfFame: {
              on: {
                NAVIGATE: {
                  guard: ({ event }) => event.phase === 'crawl',
                  target: 'crawl',
                },
              },
            },

            resolvingEncounter: {
              invoke: {
                id: 'encounter',
                src: 'encounterActor',
                input: ({ context, event }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  drinkType: event.type === 'ORDER_DRINK' ? event.drinkType : 'beer',
                }),
                onDone: {
                  target: 'standardBattle',
                  actions: assign({
                    activeEncounter: ({ event }) => ({
                      wildPubmon: event.output.wildPubmon,
                      battleStartTime: Date.now(),
                    }),
                  }),
                },
                onError: 'crawl',
              },
            },

            standardBattle: {
              on: {
                CATCH: 'resolvingCatch',
                RUN: 'resolvingRun',
                FAINT_DETECTED: 'resolvingBattle',
              },
            },

            resolvingCatch: {
              invoke: {
                id: 'catch',
                src: 'catchActor',
                input: ({ context }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  pubmonId: context.activeEncounter.wildPubmon?.id || 0,
                  battleStartTime: context.activeEncounter.battleStartTime || Date.now(),
                }),
                onDone: [
                  {
                    guard: ({ event }) => event.output.success === true,
                    target: 'celebration.caught',
                    actions: assign({
                      caughtPokemon: ({ event }) => event.output.pubmon,
                      party: ({ context, event }) => [...context.party, event.output.pubmon],
                    }),
                  },
                  {
                    target: 'standardBattle',
                  },
                ],
                onError: 'standardBattle',
              },
            },

            resolvingRun: {
              invoke: {
                id: 'run',
                src: 'runActor',
                input: ({ context }) => ({
                  socket: context.socket,
                  sessionId: context.sessionId,
                  pubmonId: context.activeEncounter.wildPubmon?.id || 0,
                  battleStartTime: context.activeEncounter.battleStartTime || Date.now(),
                }),
                onDone: {
                  target: 'crawl',
                  actions: 'clearEncounter',
                },
                onError: 'standardBattle',
              },
            },

            resolvingBattle: {
              invoke: {
                id: 'battleResolution',
                src: 'battleResolutionActor',
                input: ({ context, event }) => {
                  const outcome = (event as any).type === 'FAINT_DETECTED' ? (event as any).result : 'lose';
                  return {
                    socket: context.socket,
                    sessionId: context.sessionId,
                    pubmonId: context.activeEncounter.wildPubmon?.id || 0,
                    battleStartTime: context.activeEncounter.battleStartTime || Date.now(),
                    outcome: outcome as 'win' | 'lose',
                  };
                },
                onDone: [
                  {
                    guard: ({ event }) => event.output.outcome === 'loss',
                    target: 'crawl',
                    actions: 'clearEncounter',
                  },
                  {
                    guard: ({ event }) => event.output.awardedBadgeId != null,
                    target: 'celebration.badgeReward',
                    actions: assign({
                      xpGained: ({ event }) => event.output.xpGained || 0,
                      awardedBadgeId: ({ event }) => event.output.awardedBadgeId,
                      badges: ({ context, event }) =>
                        new Set([...context.badges, event.output.awardedBadgeId]),
                      party: ({ event }) => event.output.updatedParty || [],
                    }),
                  },
                  {
                    target: 'celebration.xpGain',
                    actions: assign({
                      xpGained: ({ event }) => event.output.xpGained || 0,
                      party: ({ event }) => event.output.updatedParty || [],
                    }),
                  },
                ],
                onError: 'crawl',
              },
            },

            celebration: {
              initial: 'caught',
              states: {
                caught: {
                  on: {
                    CONTINUE: {
                      target: '#pubmon.view.mainLoop.crawl',
                      actions: [
                        'clearEncounter',
                        assign({ caughtPokemon: null }),
                      ],
                    },
                  },
                },

                xpGain: {
                  on: {
                    CONTINUE: {
                      target: '#pubmon.view.mainLoop.crawl',
                      actions: [
                        'clearEncounter',
                        assign({ xpGained: 0 }),
                      ],
                    },
                  },
                },

                badgeReward: {
                  on: {
                    CONTINUE: {
                      target: 'xpGain',
                      actions: assign({ awardedBadgeId: null }),
                    },
                  },
                },
              },
            },
          },

          on: {
            HALL_OF_FAME_READY: '.hallOfFame',
          },
        },
      },
    },
  },
});

export type PubmonMachine = typeof pubmonMachine;
export type PubmonActor = ActorRefFrom<PubmonMachine>;
