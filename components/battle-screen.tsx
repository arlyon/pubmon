"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { type PubMon, TYPE_INFO } from "@/lib/pokemon-data"
import { PixelSprite, TypeBadge } from "./pixel-sprite"
import PixelBox from "./pixel/PixelBox"
import PixelHPBar from "./pixel/PixelHPBar"
import PixelTextBox from "./pixel/PixelTextBox"

type BattleAction = "fight" | "catch" | "run" | null
type BattleMenu = "main" | "fight" | "message"

interface BattleScreenProps {
  wildPokemon: PubMon
  playerPokemon: PubMon | null
  onFight: () => void
  onCatch: () => void
  onRun: () => void
}

const SLIDE_FRAMES = 16
const FRAME_MS = 30

export function BattleScreen({ wildPokemon, playerPokemon, onFight, onCatch, onRun }: BattleScreenProps) {
  const [menu, setMenu] = useState<BattleMenu>("main")
  const [message, setMessage] = useState<string | null>(null)
  const [selectedMove, setSelectedMove] = useState(0)
  const [enemyHp, setEnemyHp] = useState(wildPokemon.hp)
  const [playerHp, setPlayerHp] = useState(playerPokemon?.hp ?? 0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [playerShake, setPlayerShake] = useState(false)
  const [enemyShake, setEnemyShake] = useState(false)
  const [showCatchAnim, setShowCatchAnim] = useState(false)
  const [slideFrame, setSlideFrame] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const wildType = TYPE_INFO[wildPokemon.type]

  // Play battle music on mount
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log("Audio play prevented:", e))
    }
  }, [])

  // Frame-based slide-in animation for battle start
  useEffect(() => {
    let frame = 0
    let lastTime = performance.now()
    let animationId: number

    const animate = (currentTime: number) => {
      const elapsed = currentTime - lastTime

      if (elapsed >= FRAME_MS) {
        frame++
        setSlideFrame(frame)
        lastTime = currentTime

        if (frame >= SLIDE_FRAMES) {
          setTimeout(() => setShowMenu(true), 200)
          return
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [])

  const handleAttack = useCallback((moveIdx: number) => {
    if (!playerPokemon || isAnimating) return
    setIsAnimating(true)
    setMenu("message")

    const move = playerPokemon.moves[moveIdx]
    setMessage(`${playerPokemon.name} used ${move}!`)
    setEnemyShake(true)

    setTimeout(() => {
      setEnemyShake(false)
      const damage = Math.floor(Math.random() * 10) + 5
      setEnemyHp(prev => Math.max(0, prev - damage))
      setMessage(`It dealt ${damage} damage!`)

      setTimeout(() => {
        // Enemy attacks back
        const enemyMove = wildPokemon.moves[Math.floor(Math.random() * wildPokemon.moves.length)]
        setMessage(`Wild ${wildPokemon.name} used ${enemyMove}!`)
        setPlayerShake(true)

        setTimeout(() => {
          setPlayerShake(false)
          const enemyDamage = Math.floor(Math.random() * 8) + 3
          setPlayerHp(prev => Math.max(0, prev - enemyDamage))
          setMessage(`It dealt ${enemyDamage} damage!`)

          setTimeout(() => {
            setIsAnimating(false)
            setMenu("main")
            setMessage(null)
          }, 1200)
        }, 600)
      }, 1200)
    }, 600)
  }, [playerPokemon, wildPokemon, isAnimating])

  const handleCatch = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setMenu("message")
    setShowCatchAnim(true)
    setMessage("You threw a PubBall!")

    setTimeout(() => {
      const caught = Math.random() > 0.3
      setShowCatchAnim(false)
      if (caught) {
        setMessage(`Gotcha! ${wildPokemon.name} was caught!`)
        setTimeout(() => onCatch(), 2000)
      } else {
        setMessage(`Oh no! ${wildPokemon.name} broke free!`)
        setTimeout(() => {
          setIsAnimating(false)
          setMenu("main")
          setMessage(null)
        }, 1500)
      }
    }, 2000)
  }, [wildPokemon, isAnimating, onCatch])

  // Calculate pixel offsets (snap to grid of 2px)
  const progress = Math.min(slideFrame / SLIDE_FRAMES, 1)
  const eased = 1 - (1 - progress) ** 2
  const playerOffset = Math.round(((1 - eased) * 160) / 2) * 2
  const enemyOffset = Math.round(((1 - eased) * 160) / 2) * 2

  return (
    <div className="w-full max-w-md mx-auto flex flex-col" style={{ background: wildType.bgColor }}>
      <audio ref={audioRef} src="/battle.mp3" loop />

      {/* Battle arena */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(180deg, #1a1c2c 0%, ${wildType.bgColor} 40%, ${wildType.color}22 100%)`,
        }} />

        {/* Ground plane */}
        <div className="absolute bottom-0 left-0 right-0 h-[40%]">
          <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none" style={{ imageRendering: "pixelated" }}>
            {/* Ground tiles */}
            {Array.from({ length: 20 }).map((_, row) =>
              Array.from({ length: 25 }).map((_, col) => (
                <rect
                  key={`${row}-${col}`}
                  x={col * 4}
                  y={row * 2}
                  width={4}
                  height={2}
                  fill={(row + col) % 2 === 0 ? `${wildType.color}15` : `${wildType.color}08`}
                  stroke={`${wildType.color}10`}
                  strokeWidth={0.2}
                />
              ))
            )}
          </svg>
        </div>

        {/* Enemy pokemon - top right with slide-in */}
        <div
          className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10"
          style={{
            transform: `translateX(${enemyOffset}px)`,
            transition: "none",
          }}
        >
          {slideFrame >= SLIDE_FRAMES && (
            <PixelBox className="bg-transparent">
              <div className="flex items-center gap-1 mb-[2px]">
                <span className="font-pixel text-[6px] text-pixel-black">{wildPokemon.name.toUpperCase()}</span>
                <TypeBadge type={wildPokemon.type} />
              </div>
              <span className="font-pixel text-[5px] text-pixel-black block mb-[2px]">Lv{wildPokemon.level}</span>
              <PixelHPBar current={enemyHp} max={wildPokemon.maxHp} />
            </PixelBox>
          )}
        </div>

        {/* Wild pokemon sprite */}
        <div
          className="absolute top-16 right-8 z-10"
          style={{
            transform: `translateX(${enemyOffset}px)`,
            transition: "none",
            animation: enemyShake ? "pixel-shake 0.3s ease-in-out" : undefined,
          }}
        >
          {showCatchAnim ? (
            <div style={{ animation: "pokeball-shake 0.5s ease-in-out infinite" }}>
              <svg viewBox="0 0 10 10" width={60} height={60} style={{ imageRendering: "pixelated" }}>
                <circle cx={5} cy={5} r={4.5} fill="#e43b44" />
                <rect x={0.5} y={4.5} width={9} height={1} fill="#1a1c2c" />
                <circle cx={5} cy={5} r={4.5} fill="none" stroke="#1a1c2c" strokeWidth={0.5} />
                <rect x={0.5} y={5} width={9} height={4.5} rx={4.5} fill="#f4f4f4" />
                <circle cx={5} cy={5} r={1.2} fill="#f4f4f4" stroke="#1a1c2c" strokeWidth={0.4} />
                <circle cx={5} cy={5} r={0.6} fill="#1a1c2c" />
              </svg>
            </div>
          ) : (
            <PixelSprite name={wildPokemon.sprite} size={8} animated />
          )}
        </div>

        {/* Player pokemon - bottom left with slide-in */}
        {playerPokemon && (
          <>
            <div
              className="absolute bottom-20 left-4 flex flex-col items-start gap-2 z-10"
              style={{
                transform: `translateX(-${playerOffset}px)`,
                transition: "none",
              }}
            >
              {slideFrame >= SLIDE_FRAMES && (
                <PixelBox className="bg-transparent">
                  <div className="flex items-center gap-1 mb-[2px]">
                    <span className="font-pixel text-[6px] text-pixel-black">{playerPokemon.name.toUpperCase()}</span>
                    <TypeBadge type={playerPokemon.type} />
                  </div>
                  <span className="font-pixel text-[5px] text-pixel-black block mb-[2px]">Lv{playerPokemon.level}</span>
                  <PixelHPBar current={playerHp} max={playerPokemon.maxHp} label="HP" />
                </PixelBox>
              )}
            </div>

            <div
              className="absolute bottom-24 left-16 z-10"
              style={{
                transform: `translateX(-${playerOffset}px)`,
                transition: "none",
                animation: playerShake ? "pixel-shake 0.3s ease-in-out" : undefined,
              }}
            >
              <PixelSprite name={playerPokemon.sprite} size={8} flipped animated />
            </div>
          </>
        )}

        {/* Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none z-20 opacity-5"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)",
          }}
        />
      </div>

      {/* Bottom UI panel */}
      <div className="p-2">
        {/* Message display */}
        {(menu === "message" || message) && (
          <div className="mb-2">
            <PixelTextBox text={message || ""} showContinue={false} rows={2} />
          </div>
        )}

        {/* Main menu */}
        {showMenu && menu === "main" && !message && (
          <div className="grid grid-cols-2 gap-[2px]">
            <button
              onClick={() => setMenu("fight")}
              disabled={!playerPokemon}
              className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light disabled:opacity-50"
            >
              FIGHT
            </button>
            <button
              onClick={handleCatch}
              className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
            >
              CATCH
            </button>
            <button
              onClick={onFight}
              className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
            >
              PUBMON
            </button>
            <button
              onClick={onRun}
              className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
            >
              RUN
            </button>
          </div>
        )}

        {/* Fight submenu - move selection */}
        {menu === "fight" && !message && playerPokemon && (
          <div>
            <div className="grid grid-cols-2 gap-[2px] mb-[2px]">
              {playerPokemon.moves.map((move, idx) => (
                <button
                  key={move}
                  onClick={() => {
                    setSelectedMove(idx)
                    handleAttack(idx)
                  }}
                  className={`pixel-box cursor-pointer font-pixel text-[6px] text-center py-[6px] border-none ${
                    idx === selectedMove ? "bg-pixel-gray-light" : "bg-pixel-white"
                  } hover:bg-pixel-gray-light`}
                >
                  {move.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMenu("main")}
              className="w-full pixel-box cursor-pointer font-pixel text-[5px] text-pixel-black text-center py-[4px] border-none bg-pixel-white hover:bg-pixel-gray-light"
            >
              BACK
            </button>
          </div>
        )}

        {/* No player pokemon message */}
        {showMenu && !playerPokemon && menu === "main" && !message && (
          <div>
            <div className="mb-2">
              <PixelTextBox
                text={`You have no PubMon! Try to catch this wild ${wildPokemon.name.toUpperCase()}!`}
                showContinue={false}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-[2px]">
              <button
                onClick={handleCatch}
                className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
              >
                CATCH
              </button>
              <button
                onClick={onRun}
                className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none bg-pixel-white hover:bg-pixel-gray-light"
              >
                RUN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
