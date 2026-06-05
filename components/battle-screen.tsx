"use client";

import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useBattle } from "@/hooks/use-battle";
import { getPubMonBySpecies, type PubMon } from "@/lib/pokemon-data";
import { useAudio } from "./audio-manager";
import { pickBattleScene } from "./battle-scenes";
import { BattleScreenView } from "./battle-screen-view";

interface BattleScreenProps {
	wildPokemon: PubMon;
	playerPokemon: PubMon | null;
	onFight: () => void;
	onCatch: () => void; // Called when catch succeeds in sim
	onRun: () => void; // Called when run succeeds in sim
	onBattleEnd?: (result: "win" | "loss") => void; // Called when pokemon faints
	battleMode?: "wild" | "p2p"; // Optional: defaults to 'wild'
	battleId?: string; // Required if battleMode === 'p2p'
	socket?: any; // PartySocket for P2P battles
	sessionId?: string; // Required if battleMode === 'p2p'
	playerName?: string; // Trainer name to show in P2P battles
	opponentName?: string; // Opponent trainer name to show in P2P battles
	onReady?: () => void; // Fires once the field (opponent + HP) is populated
}

const SLIDE_FRAMES = 80;
const FRAME_MS = 16;
// Pokeball throw arc (~0.45s) + wobbles before the catch outcome is revealed.
const CATCH_ANIM_MS = 1600;

export function BattleScreen({
	wildPokemon,
	playerPokemon,
	onFight,
	onCatch,
	onRun,
	onBattleEnd,
	battleMode = "wild",
	battleId,
	socket,
	sessionId,
	playerName,
	opponentName,
	onReady,
}: BattleScreenProps) {
	// Factory for the P2P engine. useBattle calls this inside its mount effect so
	// a fresh engine is created on every (re)mount — required for the
	// self-connecting RemoteBattleEngine to survive React StrictMode. The engine
	// opens its own connection to the battle room (the main socket is the wrong
	// party). For wild battles we pass undefined and useBattle uses a local one.
	const createEngine = React.useMemo(() => {
		if (battleMode === "p2p" && battleId && sessionId) {
			return () => {
				const { RemoteBattleEngine } = require("@/lib/battle-engine");
				return new RemoteBattleEngine(battleId, sessionId);
			};
		}
		return undefined;
	}, [battleMode, battleId, sessionId]);

	const {
		menu,
		setMenu,
		message,
		setMessage,
		enemyHp,
		playerHp,
		isAnimating,
		setIsAnimating,
		playerShake,
		enemyShake,
		playerFlash,
		enemyFlash,
		playerAttacking,
		enemyAttacking,
		handleAttack,
		playerActivePokemon,
		enemyActivePokemon,
		battleEnded,
		battleResult,
		continueMessage,
		protocolRequest,
		battleLog,
	} = useBattle({
		wildPokemon,
		playerPokemon,
		createEngine,
		// The sim resolves the catch synchronously; we only RECORD the outcome
		// here. The throw/shake/flash animation in handleCatch decides when to
		// actually navigate (success) or pop the ball open (failure).
		onCatchSuccess: () => {
			catchOutcomeRef.current = "success";
		},
		onCatchFailure: () => {
			catchOutcomeRef.current = "fail";
		},
		onRunSuccess: onRun,
	});

	const { playCry, preloadCry } = useAudio();

	const [slideFrame, setSlideFrame] = useState(0);
	const [showMenu, setShowMenu] = useState(false);
	const [showCatchAnim, setShowCatchAnim] = useState(false);
	const [catchFlash, setCatchFlash] = useState(false);
	// Outcome recorded by the sim during a catch attempt; read after the wobble.
	const catchOutcomeRef = useRef<"success" | "fail" | null>(null);
	const catchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Catch move index awaiting resolution once the "you try to catch" message
	// is dismissed (the throw animation plays meanwhile).
	const pendingCatchRef = useRef<number | null>(null);
	// Set once a catch succeeds: dismissing the "caught!" message navigates to
	// the celebration screen.
	const pendingCatchDoneRef = useRef(false);

	// Pick a scene once per battle based on both pokemon types. Seed it with a
	// stable key (battleId for P2P, else the wild mon) so both clients in a
	// tournament see the same arena and it never changes mid-battle.
	const SceneBg = useMemo(
		() =>
			pickBattleScene(
				playerPokemon?.type ?? wildPokemon.type,
				wildPokemon.type,
				battleId ?? wildPokemon.id,
			),
		[playerPokemon?.type, wildPokemon.type, battleId, wildPokemon.id],
	);

	// Pre-load Pokemon cries when battle starts
	useEffect(() => {
		preloadCry(wildPokemon.cry);
		if (playerPokemon) {
			preloadCry(playerPokemon.cry);
		}
	}, [wildPokemon.cry, playerPokemon, preloadCry]);

	// Reset catch animation when enemy attacks (catch failed) or battle ends
	useEffect(() => {
		if (enemyAttacking || battleEnded) {
			setShowCatchAnim(false);
			setCatchFlash(false);
		}
	}, [enemyAttacking, battleEnded]);

	// Auto-transition to post-battle after message has time to display
	useEffect(() => {
		if (!battleEnded || !battleResult) return;
		const id = setTimeout(() => onBattleEnd?.(battleResult), 1500);
		return () => clearTimeout(id);
	}, [battleEnded, battleResult, onBattleEnd]);

	// Frame-based slide-in animation for battle start
	useEffect(() => {
		let frame = 0;
		let lastTime = performance.now();
		let animationId: number;

		const animate = (currentTime: number) => {
			const elapsed = currentTime - lastTime;

			if (elapsed >= FRAME_MS) {
				frame++;
				setSlideFrame(frame);
				lastTime = currentTime;

				if (frame >= SLIDE_FRAMES) {
					// Play enemy cry when animation completes
					playCry(wildPokemon.cry);

					setTimeout(() => {
						setShowMenu(true);
						// Wild battles open with a "Wild X appeared!" line; the action
						// menu stays hidden until the player dismisses it.
						if (battleMode !== "p2p") {
							setMenu("message");
							setMessage(
								`Wild ${wildPokemon.name.toUpperCase()} appeared!`,
							);
						}
					}, 200);
					return;
				}
			}

			animationId = requestAnimationFrame(animate);
		};

		animationId = requestAnimationFrame(animate);

		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	}, [wildPokemon.cry, wildPokemon.name, battleMode, setMenu, setMessage]);

	const handleBag = useCallback(() => {
		if (isAnimating) return;
		setIsAnimating(true);
		setMenu("message");
		setMessage("Oi! No drugs allowed on the premises!");
		// No auto-dismiss: the message stays until the player taps to continue
		// (handled by continueMessage, which clears the empty queue → main menu).
	}, [isAnimating, setIsAnimating, setMenu, setMessage]);

	// Flash a denial message (used to block catch/run in tournament battles)
	// without consuming a turn. Stays until the player taps to continue.
	const denyAction = useCallback(
		(text: string) => {
			if (isAnimating) return;
			setIsAnimating(true);
			setMenu("message");
			setMessage(text);
		},
		[isAnimating, setIsAnimating, setMenu, setMessage],
	);

	const handleRun = useCallback(() => {
		if (battleMode === "p2p") {
			denyAction("You can't run now!");
			return;
		}
		if (isAnimating || !protocolRequest?.active?.[0]?.moves) return;

		const runMoveIndex = protocolRequest.active[0].moves.findIndex(
			(move) => move.id === "run",
		);

		if (runMoveIndex === -1) {
			console.error("Run move not found!");
			return;
		}

		handleAttack(runMoveIndex);
	}, [battleMode, denyAction, isAnimating, protocolRequest, handleAttack]);

	// Resolve a catch attempt in the sim (called when the player dismisses the
	// "you try to catch" message). The throw/wobble has already been playing.
	const resolveCatch = useCallback(
		(catchMoveIndex: number) => {
			catchOutcomeRef.current = null;
			handleAttack(catchMoveIndex); // resolves synchronously → sets catchOutcomeRef
			if (catchOutcomeRef.current === "success") {
				// Flash the locked ball + show the catch result. Dismissing it hands
				// off to the "caught" celebration (pendingCatchDoneRef).
				setCatchFlash(true);
				setMenu("message");
				setMessage(`Gotcha! Wild ${wildPokemon.name.toUpperCase()} was caught!`);
				pendingCatchDoneRef.current = true;
			} else {
				// Ball bursts open — the wild sprite returns and "broke free" shows.
				setShowCatchAnim(false);
			}
		},
		[handleAttack, wildPokemon.name, setMenu, setMessage],
	);

	const handleCatch = useCallback(() => {
		if (battleMode === "p2p") {
			denyAction("You can't catch now!");
			return;
		}
		if (isAnimating || !protocolRequest?.active?.[0]?.moves) return;

		const catchMoveIndex = protocolRequest.active[0].moves.findIndex(
			(move) => move.id === "catch",
		);

		if (catchMoveIndex === -1) {
			console.error("Catch move not found!");
			return;
		}

		// Show the attempt message first. Dismissing it kicks off the throw /
		// wobble / outcome sequence (handleContinueMessage).
		pendingCatchRef.current = catchMoveIndex;
		setIsAnimating(true);
		setMenu("message");
		setMessage(`You try to catch wild ${wildPokemon.name.toUpperCase()}!`);
	}, [
		battleMode,
		denyAction,
		isAnimating,
		protocolRequest,
		wildPokemon.name,
		setIsAnimating,
		setMenu,
		setMessage,
	]);

	// Dismissing the "you try to catch" message resolves the attempt; otherwise
	// advance the normal battle message queue.
	const handleContinueMessage = useCallback(() => {
		// Dismissing "you try to catch" → play the full throw/wobble sequence,
		// then resolve the attempt once the animation finishes.
		if (pendingCatchRef.current != null) {
			const idx = pendingCatchRef.current;
			pendingCatchRef.current = null;
			setMessage(null);
			setShowCatchAnim(true); // throw arc + wobble
			if (catchTimerRef.current) clearTimeout(catchTimerRef.current);
			catchTimerRef.current = setTimeout(() => resolveCatch(idx), CATCH_ANIM_MS);
			return;
		}
		// Dismissing the "caught!" result → go to the celebration screen.
		if (pendingCatchDoneRef.current) {
			pendingCatchDoneRef.current = false;
			onCatch();
			return;
		}
		continueMessage();
	}, [resolveCatch, continueMessage, onCatch, setMessage]);

	// Clean up a pending catch animation timer on unmount.
	useEffect(() => {
		return () => {
			if (catchTimerRef.current) clearTimeout(catchTimerRef.current);
		};
	}, []);

	const introComplete = slideFrame >= SLIDE_FRAMES && showMenu;

	// In P2P the `wildPokemon` prop is only a placeholder (the opponent's real
	// team lives server-side). Resolve the actual opponent species from the live
	// battle stream so the arena shows the correct sprite/type/name. Falls back
	// to the placeholder until the first switch-in arrives.
	const enemyDisplayPokemon = useMemo(() => {
		if (battleMode === "p2p" && enemyActivePokemon?.species) {
			const resolved = getPubMonBySpecies(enemyActivePokemon.species);
			if (resolved) return resolved;
		}
		return wildPokemon;
	}, [battleMode, enemyActivePokemon?.species, wildPokemon]);

	const moves = protocolRequest?.active?.[0]?.moves ?? [];

	// Tell the shell when the field is populated so it can un-wipe. Wild battles
	// are ready as soon as they mount; P2P waits for the opponent + HP to arrive.
	const isP2p = battleMode === "p2p";
	const battleDataReady =
		!isP2p ||
		(!!playerActivePokemon &&
			!!enemyActivePokemon &&
			playerHp > 0 &&
			enemyHp > 0);
	useEffect(() => {
		if (battleDataReady) onReady?.();
	}, [battleDataReady, onReady]);

	return (
		<BattleScreenView
			wildPokemon={enemyDisplayPokemon}
			playerPokemon={playerPokemon}
			menu={menu}
			message={message}
			enemyHp={enemyHp}
			playerHp={playerHp}
			isAnimating={isAnimating}
			playerShake={playerShake}
			enemyShake={enemyShake}
			playerFlash={playerFlash}
			enemyFlash={enemyFlash}
			playerAttacking={playerAttacking}
			enemyAttacking={enemyAttacking}
			playerActivePokemon={playerActivePokemon}
			enemyActivePokemon={enemyActivePokemon}
			playerName={playerName}
			opponentName={opponentName}
			introComplete={introComplete}
			slideProgress={Math.min(1, slideFrame / SLIDE_FRAMES)}
			showCatchAnim={showCatchAnim}
			catchFlash={catchFlash}
			moves={moves}
			battleLog={battleLog}
			SceneBg={SceneBg}
			onFight={() => setMenu("fight")}
			onCatch={handleCatch}
			onBag={handleBag}
			onRun={handleRun}
			onSelectMove={handleAttack}
			onBackToMain={() => setMenu("main")}
			onContinueMessage={handleContinueMessage}
		/>
	);
}
