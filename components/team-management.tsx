"use client"

import { useState } from "react"
import { type PubMon, TYPE_INFO } from "@/lib/pokemon-data"
import { PixelSprite, TypeBadge } from "./pixel-sprite"
import { PixelBox, PixelButton } from "./pixel-box"

interface TeamManagementProps {
  team: PubMon[]
  onBack: () => void
  onSetActive: (index: number) => void
  activeIndex: number
}

function StatBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] text-muted-foreground w-8">{label}</span>
      <div className="flex-1 h-2 bg-background border border-foreground/30">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[8px] text-foreground w-5 text-right">{value}</span>
    </div>
  )
}

export function TeamManagement({ team, onBack, onSetActive, activeIndex }: TeamManagementProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const selected = selectedIdx !== null ? team[selectedIdx] : null

  return (
    <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
      {/* Header */}
      <PixelBox variant="battle">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">YOUR PUBMON</p>
            <p className="text-[14px] text-primary mt-1">Team</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-muted-foreground">PARTY</p>
            <p className="text-[16px] text-primary">{team.length}/6</p>
          </div>
        </div>
      </PixelBox>

      {/* Party list */}
      <PixelBox>
        {team.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <svg viewBox="0 0 10 10" width={48} height={48} style={{ imageRendering: "pixelated" }} className="opacity-30">
              <circle cx={5} cy={5} r={4.5} fill="#e43b44" />
              <rect x={0.5} y={4.5} width={9} height={1} fill="#1a1c2c" />
              <circle cx={5} cy={5} r={4.5} fill="none" stroke="#1a1c2c" strokeWidth={0.5} />
              <rect x={0.5} y={5} width={9} height={4.5} rx={4.5} fill="#f4f4f4" />
              <circle cx={5} cy={5} r={1.2} fill="#f4f4f4" stroke="#1a1c2c" strokeWidth={0.4} />
              <circle cx={5} cy={5} r={0.6} fill="#1a1c2c" />
            </svg>
            <p className="text-[10px] text-muted-foreground mt-4">No PubMon caught yet!</p>
            <p className="text-[8px] text-muted-foreground mt-1">Order a drink to encounter one.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {team.map((mon, idx) => {
              const typeInfo = TYPE_INFO[mon.type]
              const isActive = idx === activeIndex
              const isSelected = idx === selectedIdx

              return (
                <button
                  key={`${mon.id}-${idx}`}
                  onClick={() => setSelectedIdx(isSelected ? null : idx)}
                  className={`
                    flex items-center gap-3 p-2 border-2 cursor-pointer
                    transition-all font-sans text-left w-full
                    ${isSelected ? "border-primary bg-secondary" : "border-transparent hover:border-muted-foreground/30"}
                  `}
                >
                  {/* Sprite */}
                  <div
                    className="w-10 h-10 border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: typeInfo.color, background: `${typeInfo.color}22` }}
                  >
                    <PixelSprite name={mon.sprite} size={4} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] text-foreground truncate">{mon.name}</p>
                      <TypeBadge type={mon.type} />
                      {isActive && (
                        <span className="text-[7px] text-primary border border-primary px-1">LEAD</span>
                      )}
                    </div>
                    <p className="text-[8px] text-muted-foreground">Lv{mon.level}</p>
                  </div>

                  {/* HP mini bar */}
                  <div className="flex-shrink-0 w-16">
                    <div className="w-full h-1.5 bg-background border border-foreground/30">
                      <div
                        className="h-full"
                        style={{
                          width: `${(mon.hp / mon.maxHp) * 100}%`,
                          backgroundColor: (mon.hp / mon.maxHp) > 0.5 ? "#63c74d" : (mon.hp / mon.maxHp) > 0.2 ? "#e8c170" : "#e43b44",
                        }}
                      />
                    </div>
                    <p className="text-[7px] text-muted-foreground text-right mt-0.5">
                      {mon.hp}/{mon.maxHp}
                    </p>
                  </div>
                </button>
              )
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 6 - team.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center gap-3 p-2 border-2 border-dashed border-muted-foreground/20 h-14"
              >
                <p className="text-[8px] text-muted-foreground/30">-- Empty --</p>
              </div>
            ))}
          </div>
        )}
      </PixelBox>

      {/* Selected pokemon detail */}
      {selected && selectedIdx !== null && (
        <PixelBox variant="info">
          <div className="flex gap-4">
            {/* Large sprite */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-20 h-20 border-2 flex items-center justify-center"
                style={{ borderColor: TYPE_INFO[selected.type].color, background: `${TYPE_INFO[selected.type].bgColor}` }}
              >
                <PixelSprite name={selected.sprite} size={7} animated />
              </div>
              <TypeBadge type={selected.type} />
            </div>

            {/* Stats */}
            <div className="flex-1 flex flex-col gap-1">
              <p className="text-[11px] text-foreground">{selected.name}</p>
              <p className="text-[8px] text-muted-foreground">Lv{selected.level} - {TYPE_INFO[selected.type].element} Type</p>
              <div className="mt-1 flex flex-col gap-1">
                <StatBar label="HP" value={selected.maxHp} max={60} />
                <StatBar label="ATK" value={selected.attack} max={20} />
                <StatBar label="DEF" value={selected.defense} max={20} />
                <StatBar label="XP" value={selected.xp} max={100} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-2 border-t border-foreground/10 pt-2">
            <p className="text-[8px] text-muted-foreground leading-relaxed">{selected.description}</p>
          </div>

          {/* Moves */}
          <div className="mt-2 border-t border-foreground/10 pt-2">
            <p className="text-[8px] text-muted-foreground mb-1">MOVES</p>
            <div className="grid grid-cols-2 gap-1">
              {selected.moves.map((move) => (
                <div
                  key={move}
                  className="border border-foreground/20 px-2 py-1 text-[7px] text-foreground"
                >
                  {move}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-2 flex gap-2">
            {selectedIdx !== activeIndex && (
              <PixelButton
                variant="primary"
                onClick={() => onSetActive(selectedIdx)}
                className="flex-1 text-[8px]"
              >
                SET AS LEAD
              </PixelButton>
            )}
          </div>
        </PixelBox>
      )}

      {/* Back button */}
      <div className="flex justify-center">
        <PixelButton onClick={onBack} className="w-full">
          BACK
        </PixelButton>
      </div>
    </div>
  )
}
