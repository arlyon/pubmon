import React from "react"
import { PubGym } from "@/lib/pub-crawl-data"

interface GymNodeProps {
  pub: PubGym
  onClick: () => void
  isCurrent: boolean
}

const GymNode: React.FC<GymNodeProps> = ({ pub, onClick, isCurrent }) => {
  const earned = pub.badge

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-[2px] cursor-pointer border-none bg-transparent p-0"
      style={{ outline: "none" }}
    >
      {/* Badge circle */}
      <div
        className={`w-[32px] h-[32px] border-[3px] flex items-center justify-center ${
          earned
            ? "bg-primary border-foreground"
            : isCurrent
              ? "bg-accent border-foreground"
              : "bg-muted border-muted-foreground"
        }`}
        style={{
          boxShadow: isCurrent
            ? "0 0 0 2px hsl(var(--accent)), 0 0 0 4px hsl(var(--foreground))"
            : "none",
        }}
      >
        {earned ? (
          /* Badge star */
          <span className="text-[12px] text-foreground">★</span>
        ) : isCurrent ? (
          /* Current indicator */
          <span
            className="text-[10px] text-foreground"
            style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
          >
            ▶
          </span>
        ) : (
          /* Empty silhouette */
          <span className="text-[12px] text-muted-foreground">☆</span>
        )}
      </div>

      {/* Name label */}
      <div
        className={`text-center leading-[8px] max-w-[80px] text-[8px] ${
          earned
            ? "text-foreground"
            : isCurrent
              ? "text-accent-foreground"
              : "text-muted-foreground"
        }`}
      >
        {pub.name}
      </div>
    </button>
  )
}

export default GymNode
