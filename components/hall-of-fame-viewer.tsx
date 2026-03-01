"use client";

import { useEffect, useState } from "react";
import { PartySocket } from "partysocket";
import { PixelBox } from "./pixel-box";
import Image from "next/image";

interface PlayerWithRibbons {
  sessionId: string;
  name: string;
  sprite: string;
  ribbons: string[];
}

interface HallOfFameViewerProps {
  socket: PartySocket;
  sessionId: string;
}

export function HallOfFameViewer({
  socket,
  sessionId,
}: HallOfFameViewerProps) {
  const [playersWithRibbons, setPlayersWithRibbons] = useState<
    PlayerWithRibbons[]
  >([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "hall_of_fame_ready") {
        // Request player states to get full info
        // For now, we'll work with what we have
        console.log("Hall of Fame data:", msg.hallOfFame);
      } else if (msg.type === "leaderboard_sync") {
        // We need to combine leaderboard with ribbon data
        // This is a limitation - in production we'd fetch full player states
      } else if (msg.type === "player_state") {
        // Update specific player
        const player = msg.playerState;
        setPlayersWithRibbons((prev) => {
          const filtered = prev.filter((p) => p.sessionId !== player.sessionId);
          if (player.ribbons && player.ribbons.length > 0) {
            return [
              ...filtered,
              {
                sessionId: player.sessionId,
                name: player.info.name,
                sprite: player.info.sprite,
                ribbons: player.ribbons,
              },
            ];
          }
          return prev;
        });
      }
    };

    socket.addEventListener("message", handleMessage);

    // Request initial data
    socket.send(
      JSON.stringify({
        type: "check_session",
        sessionId,
      })
    );

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, sessionId]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 p-4">
      <div className="text-center py-6">
        <h1 className="text-[20px] font-pixel text-primary mb-2 animate-pulse">
          ★ HALL OF FAME ★
        </h1>
        <p className="text-[10px] text-muted-foreground">
          Honoring the Champions of the PubMon League
        </p>
      </div>

      {playersWithRibbons.length === 0 ? (
        <PixelBox variant="battle" className="w-full">
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-[12px] text-primary">Calculating Awards...</p>
            <p className="text-[8px] text-muted-foreground text-center px-4">
              The Hall of Fame ceremony will begin shortly.
            </p>
          </div>
        </PixelBox>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playersWithRibbons
            .sort((a, b) => b.ribbons.length - a.ribbons.length)
            .map((player) => (
              <PixelBox
                key={player.sessionId}
                variant={player.sessionId === sessionId ? "battle" : "default"}
                className="w-full"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 border-2 border-foreground bg-primary/10 flex items-center justify-center">
                      <span className="text-[20px]">
                        {player.sprite === "boy" ? "👦" : "👧"}
                      </span>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold">{player.name}</p>
                      <p className="text-[8px] text-muted-foreground">
                        {player.ribbons.length} ribbon
                        {player.ribbons.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {player.ribbons.map((ribbonPath, idx) => (
                      <div
                        key={idx}
                        className="relative w-10 h-10 border border-foreground bg-background p-1"
                        title={ribbonPath.split("/").pop()?.replace(".png", "")}
                      >
                        <Image
                          src={ribbonPath}
                          alt="Ribbon"
                          width={32}
                          height={32}
                          className="pixelated"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </PixelBox>
            ))}
        </div>
      )}

      <div className="text-center mt-8">
        <p className="text-[8px] text-muted-foreground italic">
          "A true PubMon Master is defined not by victories alone, but by the
          bonds formed and memories made along the journey."
        </p>
      </div>
    </div>
  );
}
