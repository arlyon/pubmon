import React from "react"
import { PubGym, weavingOffsets, masterOffset } from "@/lib/pub-crawl-data"
import GymNode from "./GymNode"

interface PubCrawlPathProps {
  pubs: PubGym[]
  onSelect: (id: number) => void
  currentId: number
}

const PubCrawlPath: React.FC<PubCrawlPathProps> = ({ pubs, onSelect, currentId }) => {
  // Reverse so we scroll bottom-to-top (first pub at bottom, master at top)
  const reversedPubs = [...pubs].reverse()
  const reversedOffsets = [...weavingOffsets].reverse()

  return (
    <div className="relative w-full pb-[8px]">
      {/* Master Tournament at top */}
      <div
        className="flex flex-col items-center mb-[8px]"
        style={{ marginLeft: masterOffset }}
      >
        <div className="w-[40px] h-[40px] border-[3px] border-foreground bg-primary flex items-center justify-center">
          <span className="text-[16px] text-primary-foreground">♛</span>
        </div>
        <div className="text-[8px] text-primary text-center mt-[2px] leading-[8px]">
          MASTER{"\n"}TOURNAMENT
        </div>
        {/* Connector down */}
        <div className="flex flex-col items-center mt-[2px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-[2px] h-[4px] bg-muted mb-[2px]" />
          ))}
        </div>
      </div>

      {/* Gym nodes with weaving path */}
      {reversedPubs.map((pub, i) => {
        const offset = reversedOffsets[i]
        const nextOffset = i < reversedPubs.length - 1 ? reversedOffsets[i + 1] : null
        const isCurrent = pub.id === currentId

        return (
          <div key={pub.id}>
            {/* Node */}
            <div
              className="flex justify-center"
              style={{ marginLeft: offset }}
            >
              <GymNode
                pub={pub}
                onClick={() => onSelect(pub.id)}
                isCurrent={isCurrent}
              />
            </div>

            {/* Connector to next node (dotted pixel line) */}
            {nextOffset !== null && (
              <ConnectorLine
                fromOffset={offset}
                toOffset={nextOffset}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Draws a pixel-perfect connector between two nodes,
 * stepping horizontally then vertically in pixel increments.
 */
const ConnectorLine: React.FC<{ fromOffset: number; toOffset: number }> = ({
  fromOffset,
  toOffset,
}) => {
  const dots = 3

  return (
    <div className="relative h-[24px]" style={{ marginLeft: 0 }}>
      {/* Simple dotted vertical with slight horizontal shift */}
      <div
        className="flex flex-col items-center absolute top-0 bottom-0"
        style={{
          left: `calc(50% + ${(fromOffset + toOffset) / 2}px)`,
        }}
      >
        {Array.from({ length: dots }).map((_, i) => (
          <div
            key={i}
            className="w-[2px] h-[4px] bg-muted"
            style={{
              marginTop: i === 0 ? 2 : 4,
              marginLeft: Math.round(
                ((toOffset - fromOffset) / dots) * (i + 1) - ((toOffset - fromOffset) / 2)
              ),
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default PubCrawlPath
