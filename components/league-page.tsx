"use client";

import { useEffect, useState } from "react";
import { PartySocket } from "partysocket";
import { PixelBox } from "./pixel-box";
import { Badge } from "./ui/badge";

interface LeaderboardEntry {
  name: string;
  drinksLogged: number;
  badges: number[];
  partyCount: number;
  tournamentOptIn?: boolean;
}

interface LeaguePageProps {
  socket: PartySocket;
  sessionId: string;
  playerName: string;
  tournamentOptIn: boolean;
  onBack: () => void;
}

export function LeaguePage({
  socket,
  sessionId,
  playerName,
  tournamentOptIn: initialOptIn,
  onBack,
}: LeaguePageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [optedIn, setOptedIn] = useState(initialOptIn);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "leaderboard_sync") {
        setLeaderboard(msg.players);
      } else if (msg.type === "player_state") {
        if (msg.playerState.sessionId === sessionId) {
          setOptedIn(msg.playerState.tournamentOptIn);
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, sessionId]);

  const handleToggleOptIn = () => {
    const newOptIn = !optedIn;

    socket.send(
      JSON.stringify({
        type: "opt_in_tournament",
        sessionId,
        optIn: newOptIn,
      })
    );

    setOptedIn(newOptIn);
  };

  // Sort leaderboard by drinks logged
  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) => b.drinksLogged - a.drinksLogged
  );

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          ← BACK
        </button>
        <h1 className="text-[14px] font-pixel text-primary">MASTER LEAGUE</h1>
        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* Tournament Opt-In */}
      <PixelBox variant="battle" className="w-full">
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold">Tournament Entry</p>
              <p className="text-[8px] text-muted-foreground">
                Opt-in to compete in the Master League Tournament
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleOptIn}
              className={`w-12 h-6 border-2 border-foreground relative transition-colors ${
                optedIn ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              <div
                className={`absolute top-0 bottom-0 w-5 h-5 bg-white border-2 border-foreground transition-all ${
                  optedIn ? "right-0" : "left-0"
                }`}
              />
            </button>
          </div>
          {optedIn && (
            <p className="text-[8px] text-green-600 font-bold">
              ✓ You're registered for the tournament!
            </p>
          )}
        </div>
      </PixelBox>

      {/* Leaderboard */}
      <PixelBox variant="default" className="w-full">
        <div className="p-2">
          <h2 className="text-[10px] font-bold mb-2 border-b-2 border-foreground pb-1">
            LEADERBOARD
          </h2>
          <div className="space-y-1">
            {sortedLeaderboard.length === 0 ? (
              <p className="text-[8px] text-muted-foreground text-center py-4">
                No players yet
              </p>
            ) : (
              sortedLeaderboard.map((player, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2 border border-foreground ${
                    player.name === playerName
                      ? "bg-primary/20"
                      : "bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-6">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-[9px] font-bold">{player.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[7px] text-muted-foreground">
                          {player.partyCount} PubMon
                        </p>
                        {player.badges.length > 0 && (
                          <p className="text-[7px] text-primary">
                            {player.badges.length} badges
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold">{player.drinksLogged}</p>
                    <p className="text-[6px] text-muted-foreground">drinks</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PixelBox>
    </div>
  );
}
