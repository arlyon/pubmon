"use client"

import { useRef, useEffect } from "react"
import { GYMS, MASTER_TOURNAMENT, type Gym } from "@/lib/gym-data"

function BadgeIcon({ icon, color, earned, size = 3 }: { icon: string[]; color: string; earned: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 8 8" width={size * 8} height={size * 8} style={{ imageRendering: "pixelated" }}>
      {icon.map((row, y) =>
        [...row].map((cell, x) => {
          if (cell === ".") return null
          let fillColor: string
          if (!earned) {
            fillColor = "#3a4466"
          } else if (cell === "a") {
            fillColor = color
          } else {
            fillColor = "#f4f4f4"
          }
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fillColor} opacity={earned ? 1 : 0.4} />
        })
      )}
    </svg>
  )
}

interface GymTrailProps {
  currentGymId: number
  badges: Set<number>
  onSelectGym: (gymId: number) => void
  onClose: () => void
}

export function GymTrail({ currentGymId, badges, onSelectGym, onClose }: GymTrailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)

  // Scroll to current gym on mount
  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = currentRef.current
      // Scroll so current gym is roughly centered
      const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    }
  }, [])

  const allBadges = badges.size >= 10

  // Build the path nodes: gyms from bottom (10) to top (1), then master tournament
  const nodes = [...GYMS].reverse()

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      {/* Header */}
      <div className="border-b-4 border-foreground bg-card p-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">GYM TRAIL</p>
            <p className="text-[8px] text-primary mt-1">
              {badges.size}/10 BADGES
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-sans border-2 border-foreground/30 px-3 py-1.5"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Scrollable trail */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-md mx-auto relative py-8 px-6" style={{ minHeight: nodes.length * 120 + 200 }}>

          {/* Master Tournament at top */}
          <div className="flex flex-col items-center mb-8">
            <div
              className={`
                relative w-20 h-20 border-4 flex items-center justify-center
                ${allBadges
                  ? "border-primary bg-primary/20 shadow-[0_0_20px_rgba(232,193,112,0.5)]"
                  : "border-foreground/20 bg-card/50"
                }
              `}
              style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
            >
              {/* Crown icon */}
              <svg viewBox="0 0 10 8" width={32} height={26} style={{ imageRendering: "pixelated" }}>
                <rect x={0} y={2} width={2} height={2} fill={allBadges ? "#e8c170" : "#3a4466"} />
                <rect x={4} y={0} width={2} height={2} fill={allBadges ? "#e8c170" : "#3a4466"} />
                <rect x={8} y={2} width={2} height={2} fill={allBadges ? "#e8c170" : "#3a4466"} />
                <rect x={0} y={4} width={10} height={2} fill={allBadges ? "#e8c170" : "#3a4466"} />
                <rect x={1} y={6} width={8} height={2} fill={allBadges ? "#c28b4a" : "#262b44"} />
              </svg>
            </div>
            <p className={`text-[9px] mt-2 text-center ${allBadges ? "text-primary" : "text-muted-foreground/50"}`}>
              {MASTER_TOURNAMENT.name}
            </p>
            <p className={`text-[7px] mt-0.5 ${allBadges ? "text-foreground" : "text-muted-foreground/30"}`}>
              {allBadges ? "UNLOCKED" : "COLLECT ALL 10 BADGES"}
            </p>
          </div>

          {/* Winding path with gym nodes */}
          {nodes.map((gym, index) => {
            const isEarnedBadge = badges.has(gym.id)
            const isCurrent = gym.id === currentGymId
            const isAccessible = gym.id <= currentGymId || isEarnedBadge

            // Weave left/right: alternate based on index
            // 0=center, 1=right, 2=center, 3=left, 4=center, 5=right...
            const pattern = index % 4
            let xOffset: string
            if (pattern === 0) xOffset = "50%"
            else if (pattern === 1) xOffset = "72%"
            else if (pattern === 2) xOffset = "50%"
            else xOffset = "28%"

            return (
              <div key={gym.id} className="relative" style={{ height: 120 }}>
                {/* Connecting path line to next node */}
                {index < nodes.length - 1 && (
                  <PathSegment
                    fromX={xOffset}
                    toX={(() => {
                      const nextPattern = (index + 1) % 4
                      if (nextPattern === 0) return "50%"
                      if (nextPattern === 1) return "72%"
                      if (nextPattern === 2) return "50%"
                      return "28%"
                    })()}
                    filled={isEarnedBadge}
                  />
                )}

                {/* Also draw path from master tournament to first node */}
                {index === 0 && (
                  <div
                    className="absolute w-[3px] bg-foreground/10"
                    style={{
                      left: xOffset,
                      top: -32,
                      height: 32,
                      transform: "translateX(-50%)",
                    }}
                  />
                )}

                {/* Gym node */}
                <div
                  ref={isCurrent ? currentRef : undefined}
                  className="absolute"
                  style={{
                    left: xOffset,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <button
                    onClick={() => {
                      if (isAccessible) onSelectGym(gym.id)
                    }}
                    disabled={!isAccessible}
                    className={`
                      relative flex flex-col items-center gap-1.5 cursor-pointer
                      disabled:cursor-not-allowed group font-sans
                    `}
                  >
                    {/* Current indicator */}
                    {isCurrent && (
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                        <div className="text-primary text-[8px]" style={{ animation: "pixel-bounce 1s ease-in-out infinite" }}>
                          {">> YOU <<"}
                        </div>
                      </div>
                    )}

                    {/* Badge circle */}
                    <div
                      className={`
                        w-14 h-14 border-4 flex items-center justify-center transition-all
                        ${isCurrent
                          ? "border-primary bg-card shadow-[0_0_12px_rgba(232,193,112,0.4)] scale-110"
                          : isEarnedBadge
                            ? "border-foreground/60 bg-card"
                            : "border-foreground/15 bg-card/30"
                        }
                        ${isAccessible && !isCurrent ? "group-hover:border-primary/50 group-hover:scale-105" : ""}
                      `}
                    >
                      {isEarnedBadge ? (
                        <BadgeIcon icon={gym.badgeIcon} color={gym.badgeColor} earned={true} size={3} />
                      ) : (
                        /* Silhouette */
                        <BadgeIcon icon={gym.badgeIcon} color={gym.badgeColor} earned={false} size={3} />
                      )}
                    </div>

                    {/* Gym name label */}
                    <div className={`text-center ${isAccessible ? "" : "opacity-30"}`}>
                      <p className={`text-[8px] leading-tight ${isCurrent ? "text-primary" : isEarnedBadge ? "text-foreground" : "text-muted-foreground"}`}>
                        {gym.name}
                      </p>
                      <p className="text-[6px] text-muted-foreground leading-tight mt-0.5">
                        {isEarnedBadge ? "BADGE EARNED" : gym.subtitle}
                      </p>
                    </div>

                    {/* Gym number */}
                    <div
                      className={`
                        absolute -right-2 -top-1 w-5 h-5 flex items-center justify-center border-2 text-[7px]
                        ${isCurrent
                          ? "border-primary bg-primary text-primary-foreground"
                          : isEarnedBadge
                            ? "border-foreground/40 bg-card text-foreground"
                            : "border-foreground/15 bg-card/30 text-muted-foreground/50"
                        }
                      `}
                    >
                      {gym.id}
                    </div>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Badge bar at bottom */}
      <div className="border-t-4 border-foreground bg-card p-3">
        <div className="max-w-md mx-auto">
          <p className="text-[7px] text-muted-foreground mb-2 text-center">BADGE COLLECTION</p>
          <div className="flex items-center justify-center gap-2">
            {GYMS.map((gym) => (
              <div
                key={gym.id}
                className={`
                  w-7 h-7 border-2 flex items-center justify-center
                  ${badges.has(gym.id) ? "border-foreground/40 bg-card" : "border-foreground/10 bg-card/30"}
                `}
                title={badges.has(gym.id) ? `${gym.name} Badge` : "???"}
              >
                <BadgeIcon icon={gym.badgeIcon} color={gym.badgeColor} earned={badges.has(gym.id)} size={2} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** SVG path segment connecting two nodes along the trail */
function PathSegment({ fromX, toX, filled }: { fromX: string; toX: string; filled: boolean }) {
  // Convert percentages to approximate pixel positions for the SVG path
  const fromPx = parseFloat(fromX)
  const toPx = parseFloat(toX)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 120"
        preserveAspectRatio="none"
        style={{ overflow: "visible" }}
      >
        <path
          d={`M ${fromPx} 60 C ${fromPx} 100, ${toPx} 20, ${toPx} 60`}
          fill="none"
          stroke={filled ? "#e8c17066" : "#3a446666"}
          strokeWidth={3}
          strokeDasharray={filled ? "none" : "4 4"}
        />
        {/* Dotted overlay for unfilled */}
        {filled && (
          <path
            d={`M ${fromPx} 60 C ${fromPx} 100, ${toPx} 20, ${toPx} 60`}
            fill="none"
            stroke="#e8c170"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}
      </svg>
    </div>
  )
}

/** Compact gym banner shown at the top of the drink select screen */
export function GymBanner({
  gym,
  badges,
  drinksAtGym,
  onOpen,
}: {
  gym: Gym
  badges: Set<number>
  drinksAtGym: number
  onOpen: () => void
}) {
  const hasBadge = badges.has(gym.id)
  const progress = Math.min(drinksAtGym / gym.requiredDrinks, 1)

  return (
    <button
      onClick={onOpen}
      className="w-full cursor-pointer font-sans group"
    >
      <div
        className="border-4 border-foreground bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] p-3 transition-all group-hover:border-primary"
      >
        <div className="absolute inset-[2px] border-2 border-foreground/20 pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          {/* Badge */}
          <div
            className="w-10 h-10 border-2 flex items-center justify-center shrink-0"
            style={{
              borderColor: hasBadge ? gym.badgeColor : "rgba(244,244,244,0.15)",
              background: hasBadge ? `${gym.badgeColor}22` : "transparent",
            }}
          >
            <BadgeIcon icon={gym.badgeIcon} color={gym.badgeColor} earned={hasBadge} size={3} />
          </div>

          {/* Info */}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-[7px] text-primary bg-primary/10 px-1.5 py-0.5 border border-primary/20">
                GYM {gym.id}
              </span>
              {hasBadge && (
                <span className="text-[6px] text-primary">BADGE EARNED</span>
              )}
            </div>
            <p className="text-[9px] text-foreground mt-1">{gym.name}</p>

            {/* Progress bar (if not earned) */}
            {!hasBadge && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-[6px] bg-background border border-foreground/20">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${progress * 100}%`,
                      background: gym.badgeColor,
                    }}
                  />
                </div>
                <span className="text-[6px] text-muted-foreground">
                  {drinksAtGym}/{gym.requiredDrinks}
                </span>
              </div>
            )}
          </div>

          {/* Expand arrow */}
          <div className="text-muted-foreground text-[10px] group-hover:text-primary transition-colors">
            {">>"}
          </div>
        </div>
      </div>
    </button>
  )
}
