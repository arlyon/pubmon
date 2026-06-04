"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { PartySocket } from "partysocket";
import { ALL_PUBMON, type PubMon } from "@/lib/pokemon-data";
import { getTrainerSprite } from "@/lib/trainer-sprites";
import type { PlayerInfo } from "@/components/player-create";
import { useAudio } from "@/components/audio-manager";
import { GBAStage, IntroStyles } from "./intro-primitives";
import {
  BootScene,
  CryScene,
  TitleScene,
  ProfessorScene,
  GenderScene,
  NameScene,
  ConfirmNameScene,
  StarterIntroScene,
  StarterPickScene,
  ReceiveScene,
  SendoffScene,
  INTRO_STARTERS,
} from "./scenes";

type Scene =
  | "boot"
  | "cry"
  | "title"
  | "professor"
  | "gender"
  | "name"
  | "confirmName"
  | "starterIntro"
  | "starterPick"
  | "receive"
  | "sendoff";

interface IntroSequenceProps {
  socket: PartySocket;
  sessionId: string;
  /** Called after player is created on the server (before starter selection) */
  onPlayerCreate: (info: PlayerInfo, existingState?: any) => void;
  /** Called after starter is selected and confirmed */
  onStarterSelect: (pokemon: PubMon) => void;
  /**
   * When provided, the title screen "START" hands off here instead of
   * continuing into character creation. Used for the pre-tournament teaser.
   */
  onTitleStart?: () => void;
}

/**
 * Full-screen GBA-style intro sequence.
 * Replaces both PlayerCreate and StarterSelect with a cinematic flow:
 * boot → title → professor → gender → name → confirmName →
 * starterIntro → starterPick → receive → sendoff
 */
export function IntroSequence({
  socket,
  sessionId,
  onPlayerCreate,
  onStarterSelect,
  onTitleStart,
}: IntroSequenceProps) {
  const [scene, setScene] = useState<Scene>("boot");
  const [transitioning, setTransitioning] = useState(false);
  const [player, setPlayer] = useState<{
    kind: "boy" | "girl";
    name: string;
    starter: (typeof INTRO_STARTERS)[0] | null;
  }>({ kind: "boy", name: "", starter: null });

  const { playBGM, playSFX, playCry } = useAudio();

  // Play the right BGM for each scene
  useEffect(() => {
    switch (scene) {
      case "boot":
      case "cry":
      case "title":
        playBGM("title-screen");
        break;
      case "professor":
      case "gender":
      case "name":
      case "confirmName":
        playBGM("world-of-pokemon");
        break;
      case "starterIntro":
      case "starterPick":
      case "sendoff":
        playBGM("pokemon-lab");
        break;
      case "receive":
        playSFX("pokemon-obtained", true);
        break;
    }
  }, [scene, playBGM, playSFX]);

  const goto = useCallback((next: Scene) => {
    setTransitioning(true);
    setTimeout(() => {
      setScene(next);
      setTimeout(() => setTransitioning(false), 60);
    }, 240);
  }, []);

  // Server communication: check name availability and create player
  const handleNameDone = useCallback(
    (name: string) => {
      setPlayer((p) => ({ ...p, name }));

      // Check name availability
      socket.send(JSON.stringify({ type: "check_name", name }));

      const handleMessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "name_status") {
          socket.removeEventListener("message", handleMessage);

          if (!msg.available) {
            // Name taken — claim it (this is a pub game, we allow takeover)
            socket.send(
              JSON.stringify({
                type: "claim_player",
                name,
                newSessionId: sessionId,
              }),
            );

            const handleClaim = (event2: MessageEvent) => {
              const msg2 = JSON.parse(event2.data);
              if (msg2.type === "player_state") {
                socket.removeEventListener("message", handleClaim);
                // Player already exists with state — restore and skip to crawl
                onPlayerCreate(
                  { name, gender: player.kind },
                  msg2.playerState,
                );
              }
            };
            socket.addEventListener("message", handleClaim);
            return;
          }

          // Name is available — create the player
          const sprite = getTrainerSprite(name, player.kind);
          socket.send(
            JSON.stringify({
              type: "create_player",
              sessionId,
              playerInfo: { name, sprite },
            }),
          );

          const handleCreate = (event2: MessageEvent) => {
            const msg2 = JSON.parse(event2.data);
            if (
              msg2.type === "player_created" ||
              msg2.type === "player_state"
            ) {
              socket.removeEventListener("message", handleCreate);
              const existingState =
                msg2.type === "player_state" ? msg2.playerState : undefined;
              if (existingState?.party?.length > 0) {
                // Already has a party — skip to crawl
                onPlayerCreate({ name, gender: player.kind }, existingState);
              } else {
                // New player — notify parent, then continue intro for starter select
                onPlayerCreate({ name, gender: player.kind }, existingState);
                goto("starterIntro");
              }
            } else if (msg2.type === "error") {
              socket.removeEventListener("message", handleCreate);
              // Fallback: go back to name
              goto("name");
            }
          };
          socket.addEventListener("message", handleCreate);
        }
      };
      socket.addEventListener("message", handleMessage);

      // Optimistically show the confirm screen while server processes
      goto("confirmName");
    },
    [socket, sessionId, player.kind, goto, onPlayerCreate],
  );

  // Server communication: select starter
  // We store the chosen pokemon and only call onStarterSelect when sendoff finishes,
  // so the receive/sendoff scenes have time to play before the machine transitions.
  const chosenPokemonRef = React.useRef<PubMon | null>(null);

  const handleStarterPick = useCallback(
    (starter: (typeof INTRO_STARTERS)[0]) => {
      setPlayer((p) => ({ ...p, starter }));

      const STARTER_NAMES: Record<string, string> = {
        beer: "Hoppsin",
        shot: "Tequilar",
        wine: "Charderan",
        water: "Stillbar",
        cocktail: "Martini",
      };
      const starterName = STARTER_NAMES[starter.id];
      const pokemon = ALL_PUBMON.find((p) => p.name === starterName);

      if (pokemon) {
        chosenPokemonRef.current = { ...pokemon, hp: pokemon.maxHp };
      }

      goto("receive");
    },
    [goto],
  );

  const handleSendoffDone = useCallback(() => {
    if (chosenPokemonRef.current) {
      onStarterSelect(chosenPokemonRef.current);
    }
  }, [onStarterSelect]);

  let view: React.ReactNode = null;
  switch (scene) {
    case "boot":
      view = <BootScene onDone={() => goto("cry")} />;
      break;
    case "cry":
      view = <CryScene onDone={() => goto("title")} playCry={playCry} />;
      break;
    case "title":
      view = (
        <TitleScene
          onStart={() => (onTitleStart ? onTitleStart() : goto("professor"))}
        />
      );
      break;
    case "professor":
      view = <ProfessorScene onDone={() => goto("gender")} />;
      break;
    case "gender":
      view = (
        <GenderScene
          onPick={(k) => {
            setPlayer((p) => ({ ...p, kind: k }));
            goto("name");
          }}
        />
      );
      break;
    case "name":
      view = <NameScene kind={player.kind} onDone={handleNameDone} />;
      break;
    case "confirmName":
      view = (
        <ConfirmNameScene
          name={player.name}
          kind={player.kind}
          onDone={() => goto("starterIntro")}
        />
      );
      break;
    case "starterIntro":
      view = (
        <StarterIntroScene
          name={player.name}
          onDone={() => goto("starterPick")}
        />
      );
      break;
    case "starterPick":
      view = <StarterPickScene onPick={handleStarterPick} />;
      break;
    case "receive":
      view = player.starter ? (
        <ReceiveScene
          name={player.name}
          starter={player.starter}
          onDone={() => goto("sendoff")}
        />
      ) : null;
      break;
    case "sendoff":
      view = player.starter ? (
        <SendoffScene
          name={player.name}
          starter={player.starter}
          onDone={handleSendoffDone}
        />
      ) : null;
      break;
  }

  return (
    <GBAStage>
      <IntroStyles />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: transitioning ? 0 : 1,
          transition: "opacity 0.18s steps(3)",
        }}
      >
        {view}
      </div>
      {transitioning && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            animation: "intro-flash-white 0.24s steps(3)",
            pointerEvents: "none",
            zIndex: 10000,
          }}
        />
      )}
    </GBAStage>
  );
}
