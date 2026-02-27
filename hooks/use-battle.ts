import { useState, useCallback, useEffect, useRef } from "react"
import { type PubMon, getBaseMoveForAudio } from "@/lib/pokemon-data"
import { BattleStreams, RandomPlayerAI, Teams, Dex } from "@pkmn/sim"
import { Battle } from "@pkmn/client"
import { type ID } from "@pkmn/dex-types"
import { Generations } from "@pkmn/data"
import { type Protocol } from "@pkmn/protocol"
import { generatePubMonModData } from "@/lib/pokemon-data"
import { useAudio } from "@/components/audio-manager"

const customDex = Dex.mod('pubmon' as ID, generatePubMonModData() as any);
const gens = new Generations(customDex as any);

export type BattleMenu = "main" | "fight" | "message"

export interface MoveSlot {
    name: string
    pp: number
    maxpp: number
    disabled: boolean
}

export interface ActivePokemon {
    name: string
    hp: number
    maxhp: number
    status: string | null
    moves: MoveSlot[]
    boosts: {
        atk: number
        def: number
        spa: number
        spd: number
        spe: number
    }
}

interface UseBattleProps {
    wildPokemon: PubMon
    playerPokemon: PubMon | null
}

export function useBattle({ wildPokemon, playerPokemon }: UseBattleProps) {
    const [menu, setMenu] = useState<BattleMenu>("main")
    const [message, setMessage] = useState<string | null>(null)
    const [enemyHp, setEnemyHp] = useState(0)
    const [playerHp, setPlayerHp] = useState(0)
    const [isAnimating, setIsAnimating] = useState(false)
    const [playerShake, setPlayerShake] = useState(false)
    const [enemyShake, setEnemyShake] = useState(false)
    const [playerActivePokemon, setPlayerActivePokemon] = useState<ActivePokemon | null>(null)
    const [enemyActivePokemon, setEnemyActivePokemon] = useState<ActivePokemon | null>(null)
    const [battleEnded, setBattleEnded] = useState(false)
    const [battleResult, setBattleResult] = useState<'win' | 'loss' | null>(null)

    // Track PP usage for player's moves
    const movePPUsage = useRef<Map<string, number>>(new Map())

    // Audio hook
    const { playAttackSFX } = useAudio()

    const battleRef = useRef<Battle | null>(null)
    const streamRef = useRef<BattleStreams.BattleStream | null>(null)
    const p1Ref = useRef<any>(null)
    const messageQueueRef = useRef<string[]>([])
    const processingRef = useRef(false)
    const lastRequestRef = useRef<Protocol.Request | null>(null)

    const processMessageQueue = useCallback(() => {
        if (processingRef.current) {
            return
        }

        if (messageQueueRef.current.length === 0) {
            setIsAnimating(false)
            setMenu("main")
            setMessage(null)
            return
        }

        processingRef.current = true
        setIsAnimating(true)
        setMenu("message")

        const nextMsg = messageQueueRef.current.shift()!
        setMessage(nextMsg)

        setTimeout(() => {
            processingRef.current = false
            processMessageQueue()
        }, 1200)

    }, [])

    const extractPokemonState = useCallback((pokemon: any, playerIndex: 'p1' | 'p2', sourceMoves?: string[]): ActivePokemon | null => {
        if (!pokemon) return null

        try {
            console.log(`Extracting ${playerIndex} state:`, {
                pokemon,
                'pokemon.hp': pokemon.hp,
                'pokemon.baseMaxhp': pokemon.baseMaxhp,
                'pokemon.maxhp': pokemon.maxhp,
                'typeof pokemon.hp': typeof pokemon.hp,
                'pokemon.moveSlots': pokemon.moveSlots,
                sourceMoves,
                'movePPUsage': Array.from(movePPUsage.current.entries())
            })

            // Extract HP from @pkmn/client
            // p1 (player): pokemon.hp is the actual HP value
            // p2 (opponent): pokemon.hp is a percentage (0-100)
            let hp: number;
            let maxhp: number;

            if (typeof pokemon.hp === 'string') {
                // Format: "45/45"
                const parts = pokemon.hp.split('/');
                hp = parseInt(parts[0]);
                maxhp = parseInt(parts[1]);
            } else if (pokemon.baseMaxhp && pokemon.baseMaxhp > 0) {
                maxhp = pokemon.baseMaxhp;
                if (playerIndex === 'p1') {
                    // Player gets actual HP value
                    hp = pokemon.hp;
                } else {
                    // Opponent gets percentage (0-100)
                    hp = Math.round((pokemon.hp / 100) * maxhp);
                }
            } else {
                // Fallback
                maxhp = pokemon.maxhp || 100;
                hp = typeof pokemon.hp === 'number' ? pokemon.hp : 100;
            }

            console.log(`${playerIndex} HP calculation:`, {
                'raw pokemon.hp': pokemon.hp,
                'pokemon.baseMaxhp': pokemon.baseMaxhp,
                'pokemon.maxhp': pokemon.maxhp,
                'calculated hp': hp,
                'calculated maxhp': maxhp
            })

            // Extract status
            const status = pokemon.status || null

            // Build moves from the source PubMon data with PP tracking
            const moves: MoveSlot[] = []

            // First, try to get moves from pokemon.moveSlots (if available from sim)
            if (pokemon.moveSlots && pokemon.moveSlots.length > 0) {
                console.log('Using moveSlots from pokemon object:', pokemon.moveSlots)
                for (const slot of pokemon.moveSlots) {
                    if (slot) {
                        moves.push({
                            name: slot.move || slot.id || '',
                            pp: slot.pp || 0,
                            maxpp: slot.maxpp || 20,
                            disabled: slot.disabled || (slot.pp <= 0)
                        })
                    }
                }
            } else if (sourceMoves && sourceMoves.length > 0) {
                // Fallback to source moves with manual PP tracking
                console.log('Using sourceMoves with manual tracking:', sourceMoves)
                for (const moveName of sourceMoves) {
                    const ppUsed = movePPUsage.current.get(moveName) || 0
                    const maxpp = 15 // Changed from 20 to match the Dex definition
                    const pp = Math.max(0, maxpp - ppUsed)

                    moves.push({
                        name: moveName,
                        pp,
                        maxpp,
                        disabled: pp <= 0
                    })
                }
            }

            // Extract boosts
            const boosts = {
                atk: pokemon.boosts?.atk || 0,
                def: pokemon.boosts?.def || 0,
                spa: pokemon.boosts?.spa || 0,
                spd: pokemon.boosts?.spd || 0,
                spe: pokemon.boosts?.spe || 0,
            }

            return {
                name: pokemon.name || pokemon.species || 'Unknown',
                hp: hp > 0 ? hp : 0,
                maxhp,
                status,
                moves,
                boosts
            }
        } catch (error) {
            console.error('Error extracting Pokemon state:', error)
            return null
        }
    }, [])

    const handleEngineChunk = useCallback((chunk: string) => {
        if (!battleRef.current) return

        console.debug('Engine chunk received:', chunk)

        for (const line of chunk.split("\n")) {
            if (!line) continue
            console.debug('Processing line:', line)

            let requestObj: Protocol.Request | undefined;
            if (line.startsWith("|request|")) {
                const jsonStr = line.split("|").slice(2).join("|");
                try {
                    requestObj = JSON.parse(jsonStr);
                } catch (e) {
                    console.error('Failed to parse request:', e)
                }
            }

            try {
                battleRef.current.add(line)
            } catch (e) {
                // @pkmn/client doesn't fully support custom mods and will throw an error
                // when trying to clean up terastallization info on faint (searchid is undefined).
                // This is harmless since tera is a Gen 9 feature not relevant to Gen 1 mods.
                // We catch and ignore this specific error but rethrow others.
                if (e instanceof TypeError && e.message?.includes('searchid')) {
                    console.debug('Ignoring searchid error from @pkmn/client (custom species)')
                } else {
                    throw e
                }
            }
            const req = requestObj || battleRef.current.request;
            if (req) {
                battleRef.current.update(req);
                lastRequestRef.current = req;
            }

            // Track PP usage when player uses a move
            if (line.startsWith("|move|p1a")) {
                const parts = line.split("|")
                const moveName = parts[3]
                if (moveName) {
                    const currentPP = movePPUsage.current.get(moveName) || 0
                    movePPUsage.current.set(moveName, currentPP + 1)
                }
            }

            // Extract full Pokemon state for both players
            if (battleRef.current.p1.active[0]) {
                const p1Pokemon = battleRef.current.p1.active[0]
                // Only extract if species is properly loaded
                if (p1Pokemon.baseSpeciesForme) {
                    const p1State = extractPokemonState(
                        p1Pokemon,
                        'p1',
                        playerPokemon?.moves
                    )
                    if (p1State && p1State.maxhp > 0) {
                        console.log('Setting p1 HP:', p1State.hp, '/', p1State.maxhp)
                        setPlayerActivePokemon(p1State)
                        setPlayerHp(p1State.hp)
                    }
                }
            }

            if (battleRef.current.p2.active[0]) {
                const p2Pokemon = battleRef.current.p2.active[0]
                // Only extract if species is properly loaded
                if (p2Pokemon.baseSpeciesForme) {
                    const p2State = extractPokemonState(
                        p2Pokemon,
                        'p2',
                        wildPokemon.moves
                    )
                    if (p2State && p2State.maxhp > 0) {
                        setEnemyActivePokemon(p2State)
                        setEnemyHp(p2State.hp)
                    }
                }
            }

            if (line.startsWith("|-damage|")) {
                const parts = line.split("|")
                const pkmn = parts[2].substring(4)
                messageQueueRef.current.push(`${pkmn} took damage!`)
                if (parts[2].startsWith("p1a")) setPlayerShake(true)
                if (parts[2].startsWith("p2a")) setEnemyShake(true)
                setTimeout(() => {
                    setEnemyShake(false)
                    setPlayerShake(false)
                }, 400)
            } else if (line.startsWith("|move|")) {
                const parts = line.split("|")
                const pkmn = parts[2].substring(4)
                const move = parts[3]
                messageQueueRef.current.push(`${pkmn} used ${move}!`)

                // Trigger attack sound effect
                // Convert move name to ID format and lookup base Gen 1 move
                const moveId = move.toLowerCase().replace(/[^a-z0-9]+/g, '')
                const baseMoveId = getBaseMoveForAudio(moveId)
                if (baseMoveId) {
                    playAttackSFX(baseMoveId)
                } else {
                    // Fallback to Tackle if no mapping found
                    console.warn(`No base move mapping found for '${move}', using Tackle`)
                    playAttackSFX('tackle')
                }
            } else if (line.startsWith("|-supereffective|")) {
                messageQueueRef.current.push("It's super effective!")
            } else if (line.startsWith("|-resisted|")) {
                messageQueueRef.current.push("It's not very effective...")
            } else if (line.startsWith("|faint|")) {
                const pkmn = line.split("|")[2].substring(4)
                messageQueueRef.current.push(`${pkmn} fainted!`)
            } else if (line.startsWith("|win|")) {
                const winner = line.split("|")[2]
                setBattleEnded(true)
                if (winner === "Player") {
                    setBattleResult('win')
                    messageQueueRef.current.push("VICTORY!")
                } else {
                    setBattleResult('loss')
                    messageQueueRef.current.push("DEFEATED...")
                }
            } else if (line.startsWith("|-status|")) {
                const parts = line.split("|")
                const pkmn = parts[2].substring(4)
                const status = parts[3]
                messageQueueRef.current.push(`${pkmn} was ${status}!`)
            } else if (line.startsWith("|-boost|") || line.startsWith("|-unboost|")) {
                const parts = line.split("|")
                const pkmn = parts[2].substring(4)
                const stat = parts[3]
                const amount = parts[4]
                const direction = line.startsWith("|-boost|") ? "rose" : "fell"
                messageQueueRef.current.push(`${pkmn}'s ${stat.toUpperCase()} ${direction}!`)
            }
        }

        processMessageQueue()
    }, [processMessageQueue, extractPokemonState, playerPokemon, wildPokemon])

    useEffect(() => {
        if (!playerPokemon) return

        const stream = new BattleStreams.BattleStream({ debug: true }, customDex as any)
        const streams = BattleStreams.getPlayerStreams(stream)

        streamRef.current = stream
        p1Ref.current = streams.p1
        battleRef.current = new Battle(gens)

        const p2AI = new RandomPlayerAI(streams.p2)
        console.log('Starting p2 AI...')
        void p2AI.start().then(() => {
            console.log('p2 AI started successfully')
        }).catch((error: any) => {
            console.error('Error starting p2 AI:', error)
        })

        // Listen to omniscient stream for battle messages
        void (async () => {
            try {
                for await (const chunk of streams.omniscient) {
                    handleEngineChunk(chunk)
                }
            } catch (error) {
                console.error('Error in omniscient stream:', error)
            }
        })();

        // ALSO listen to p1 stream for player-specific messages (including |request|)
        void (async () => {
            try {
                for await (const chunk of streams.p1) {
                    console.debug('P1 stream chunk received:', chunk)
                    handleEngineChunk(chunk)
                }
            } catch (error) {
                console.error('Error in p1 stream:', error)
            }
        })();

        const formatId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '')

        const createTeam = (name: string, p: any) => Teams.pack([{
            name: name,
            species: formatId(p.name),
            item: '',
            ability: '',
            moves: p.moves.map(formatId),
            nature: '',
            evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            level: p.level,
            gender: 'M'
        } as any])

        const p1Team = createTeam('Player', playerPokemon)
        const p2Team = createTeam('Wild PubMon', wildPokemon)

        streams.omniscient.write(
            `>start {"formatid":"gen1pubmon"}\n` +
            `>player p1 {"name":"Player","team":"${p1Team}"}\n` +
            `>player p2 {"name":"Wild PubMon","team":"${p2Team}"}`
        )
    }, [playerPokemon, wildPokemon, handleEngineChunk])

    const handleAttack = useCallback((moveIdx: number) => {
        console.log('handleAttack called:', {
            moveIdx,
            'p1Ref.current': p1Ref.current,
            isAnimating,
            command: `>p1 move ${moveIdx + 1}`
        })

        if (!p1Ref.current) {
            console.error('p1Ref.current is null!')
            return
        }
        if (isAnimating) {
            console.log('Blocked by isAnimating')
            return
        }

        setIsAnimating(true)

        const command = `move ${moveIdx + 1}`
        console.log('Writing command to battle stream:', command)
        console.log('p1 stream state:', {
            writable: p1Ref.current.writable,
            writableEnded: p1Ref.current.writableEnded,
            writableFinished: p1Ref.current.writableFinished
        })
        const writeResult = p1Ref.current.write(command)
        console.log('Write result:', writeResult)
    }, [isAnimating])

    return {
        menu, setMenu,
        message, setMessage,
        enemyHp, playerHp,
        isAnimating, setIsAnimating,
        playerShake, enemyShake,
        handleAttack,
        playerActivePokemon,
        enemyActivePokemon,
        battleEnded,
        battleResult
    }
}
