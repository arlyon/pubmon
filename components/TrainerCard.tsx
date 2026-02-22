"use client"

import React from "react"
import { PixelBox } from "./pixel-box"

interface TrainerCardProps {
  trainerName?: string
  badgeCount: number
  money?: number
  time?: string
  gender?: "male" | "female"
}

export function TrainerCard({
  trainerName = "RED",
  badgeCount,
  money = 0,
  time,
  gender = "male",
}: TrainerCardProps) {
  const genderSymbol = gender === "male" ? "♂" : "♀"
  const genderColor = gender === "male" ? "bg-accent" : "bg-primary"

  return (
    <PixelBox>
      <div className="flex items-center gap-[8px] mb-[6px]">
        <div className={`w-[32px] h-[32px] ${genderColor} border-2 border-foreground flex items-center justify-center`}>
          <span className="text-[12px] text-foreground">{genderSymbol}</span>
        </div>
        <div>
          <div className="text-[10px] text-foreground font-semibold">{trainerName}</div>
          <div className="text-[8px] text-muted-foreground mt-[2px]">BADGES: {badgeCount}</div>
        </div>
      </div>
      <div className="text-[8px] text-foreground">
        MONEY: ¥{money.toLocaleString()}
      </div>
      {time && (
        <div className="text-[8px] text-foreground mt-[2px]">
          TIME: {time}
        </div>
      )}
    </PixelBox>
  )
}
