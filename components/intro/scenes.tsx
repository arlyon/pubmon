"use client";

import { useCallback, useEffect, useState } from "react";
import {
	ALL_PUBMON,
	getPubMonSprite,
	type PubMon,
	type PubType,
	TYPE_INFO,
} from "@/lib/pokemon-data";
import {
	type Gender,
	hasCustomTrainerSprite,
	getTrainerSpritePath,
	resolveTrainerSprite,
} from "@/lib/trainer-sprites";
import {
	IntroButton,
	IntroDialog,
	IntroPokeball,
	IntroProfessor,
	IntroSparkles,
	ProfBackground,
} from "./intro-primitives";

// ═══════════════════════════════════════════════════════════════════
// BOOT SCENE
// ═══════════════════════════════════════════════════════════════════
export function BootScene({ onDone }: { onDone: () => void }) {
	useEffect(() => {
		const t = setTimeout(onDone, 2000);
		return () => clearTimeout(t);
	}, [onDone]);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: "#000",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				flexDirection: "column",
				gap: 8,
			}}
		>
			<div
				style={{
					animation: "intro-pop 0.5s steps(6) 0.2s both",
				}}
			>
				<IntroPokeball size={32} state="spin" />
			</div>
			<div
				style={{
					fontFamily: "'Press Start 2P', monospace",
					fontSize: 7,
					color: "#5a6988",
					animation: "intro-blink-slow 1s steps(2) 1s infinite",
				}}
			>
				©2026 PUBMON · BARLEY LABS
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// CRY SCENE — Mojitoad pans across screen with a roar
// ═══════════════════════════════════════════════════════════════════
export function CryScene({
	onDone,
	playCry,
}: {
	onDone: () => void;
	playCry: (n: number, requireLoaded?: boolean) => void;
}) {
	const [phase, setPhase] = useState<"pan" | "hold" | "fade">("pan");

	useEffect(() => {
		// Pan takes 1.6s (smooth ease-out), then hold with cry
		const holdTimer = setTimeout(() => setPhase("hold"), 1600);
		// Cry fires right as it lands center — but only if it's already loaded;
		// we never delay the intro waiting on it.
		const cryTimer = setTimeout(() => playCry(29, true), 1600);
		// Fade out after the shake/flash settles
		const fadeTimer = setTimeout(() => setPhase("fade"), 3000);
		// Done
		const doneTimer = setTimeout(onDone, 3800);
		return () => {
			clearTimeout(holdTimer);
			clearTimeout(cryTimer);
			clearTimeout(fadeTimer);
			clearTimeout(doneTimer);
		};
	}, [onDone, playCry]);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: "#000",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
			}}
		>
			{/* Shake wrapper — only shakes during hold */}
			<div
				style={{
					animation:
						phase === "hold"
							? "intro-cry-shake 0.12s ease-in-out 4"
							: undefined,
				}}
			>
				<img
					src="/sprites/pubmon/Mojitoad_00001_.png"
					alt="Mojitoad"
					style={{
						width: 128,
						height: 128,
						imageRendering: "pixelated",
						// Smooth pan from right, then stay put
						animation: "intro-cry-pan 1.6s cubic-bezier(0.16, 1, 0.3, 1) both",
						opacity: phase === "fade" ? 0 : 1,
						filter: phase === "hold" ? "brightness(1.15)" : "brightness(0.8)",
						transition: "filter 0.2s ease, opacity 0.8s ease-out",
					}}
				/>
			</div>
			{/* White flash on cry */}
			{phase === "hold" && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(circle at center, rgba(255,255,255,0.18) 0%, transparent 65%)",
						animation: "intro-cry-flash 0.5s ease-out both",
						pointerEvents: "none",
					}}
				/>
			)}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// TITLE SCENE
// ═══════════════════════════════════════════════════════════════════
export function TitleScene({ onStart }: { onStart: () => void }) {
	const [pressed, setPressed] = useState(false);

	const start = useCallback(() => {
		if (pressed) return;
		setPressed(true);
		setTimeout(onStart, 700);
	}, [pressed, onStart]);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				if (!pressed) start();
			}
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [pressed, start]);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(180deg, #d8a060 0%, #f0c878 35%, #f8d8a0 60%, #c8e8d0 90%, #88c898 100%)",
				overflow: "hidden",
			}}
		>
			{/* Sun */}
			<div
				style={{
					position: "absolute",
					top: 28,
					left: 30,
					width: 28,
					height: 28,
					background: "#f8e890",
					border: "2px solid #d89858",
					borderRadius: "50%",
					boxShadow: "0 0 0 4px rgba(248,232,144,0.4)",
				}}
			/>
			{/* Pub silhouette */}
			<div
				style={{
					position: "absolute",
					bottom: 30,
					left: 0,
					right: 0,
					height: 36,
					background: "#48604a",
					clipPath:
						"polygon(0% 100%,0% 60%,8% 60%,8% 40%,16% 40%,16% 60%,24% 60%,24% 30%,40% 30%,42% 24%,46% 24%,48% 18%,52% 18%,54% 24%,58% 24%,60% 30%,76% 30%,76% 50%,84% 50%,84% 70%,92% 70%,92% 50%,100% 50%,100% 100%)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					height: 30,
					background: "linear-gradient(180deg, #88c898 0%, #588858 100%)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: 6,
					left: 0,
					right: 0,
					height: 6,
					backgroundImage:
						"repeating-linear-gradient(90deg, #486848 0, #486848 2px, transparent 2px, transparent 6px)",
				}}
			/>
			{/* Title */}
			<div
				style={{
					position: "absolute",
					top: 50,
					left: 0,
					right: 0,
					textAlign: "center",
					animation:
						"intro-title-drop 0.9s cubic-bezier(.18,.89,.32,1.28) both",
				}}
			>
				<div
					style={{
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 32,
						color: "#f8d030",
						letterSpacing: 1,
						textShadow:
							"2px 0 #181010, -2px 0 #181010, 0 2px #181010, 0 -2px #181010, 2px 2px 0 #a82828, 4px 4px 0 #181010",
						animation: "intro-title-flash 2.4s steps(8) infinite",
					}}
				>
					PUBMON
				</div>
			</div>
			{/* Pokeball mascot */}
			<div
				style={{
					position: "absolute",
					top: 100,
					right: 28,
					animation: "intro-bob-pkmn 1s steps(2) infinite",
				}}
			>
				<IntroPokeball size={28} />
			</div>
			{/* Mug mascot */}
			<div
				style={{
					position: "absolute",
					top: 102,
					left: 24,
					animation: "intro-bob-pkmn 1s steps(2) infinite 0.5s",
				}}
			>
				<img
					src="/sprites/beerMini.png"
					alt="Beer"
					style={{
						width: 36,
						height: 36,
						imageRendering: "pixelated",
					}}
				/>
			</div>
			{/* Subtitle */}
			<div
				style={{
					position: "absolute",
					top: 150,
					left: 0,
					right: 0,
					textAlign: "center",
					fontFamily: "'Press Start 2P', monospace",
					fontSize: 7,
					color: "#181010",
					textShadow: "1px 1px 0 #f8f0d0",
					animation: "intro-pop 0.4s steps(4) 0.9s both",
				}}
			>
				A · PUB · CRAWL · BATTLE · GAME
			</div>
			{/* Press Start */}
			<div
				style={{
					position: "absolute",
					bottom: 36,
					left: 0,
					right: 0,
					textAlign: "center",
					animation: pressed
						? "intro-blink 0.06s steps(2) infinite"
						: "intro-blink 1.05s step-end infinite",
				}}
			>
				<button
					onClick={start}
					style={{
						display: "inline-block",
						padding: "6px 12px",
						background: "#181010",
						border: "2px solid #f8d030",
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 9,
						color: "#f8d030",
						letterSpacing: 1,
						boxShadow:
							"inset 1px 1px 0 #a88820, inset -1px -1px 0 #181010, 2px 2px 0 rgba(0,0,0,0.4)",
						cursor: "pointer",
						borderRadius: 0,
					}}
				>
					PRESS START
				</button>
			</div>
			{/* Footer */}
			<div
				style={{
					position: "absolute",
					bottom: 16,
					left: 0,
					right: 0,
					textAlign: "center",
					fontFamily: "'Press Start 2P', monospace",
					fontSize: 6,
					color: "#283028",
				}}
			>
				©2026 PUBMON · PUB FREAK
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// PROFESSOR SCENE
// ═══════════════════════════════════════════════════════════════════
const PROF_LINES: [string, string][] = [
	["Hello there!", "Welcome to the world of PUBMON!"],
	["My name is BARLEY.", "Folks call me the PUB PROFESSOR."],
	["This world is inhabited far and wide", "by creatures called PUBMON!"],
	["For some, PUBMON are companions.", "Others use them for friendly battle."],
	["Myself... I study PUBMON behaviour", "and the drinks that draw them out."],
	["But before we get to all that…", "Let's get to know YOU, trainer!"],
];

export function ProfessorScene({ onDone }: { onDone: () => void }) {
	const [step, setStep] = useState(0);
	const [entering, setEntering] = useState(true);

	useEffect(() => {
		const t = setTimeout(() => setEntering(false), 700);
		return () => clearTimeout(t);
	}, []);

	const advance = useCallback(() => {
		if (step >= PROF_LINES.length - 1) onDone();
		else setStep((s) => s + 1);
	}, [step, onDone]);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") advance();
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [advance]);

	// Show Ipape on the "creatures called PUBMON" slide (step 2)
	const showIpape = step >= 2;

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<ProfBackground />
			<IntroProfessor entering={entering} mood={entering ? "idle" : "bob"} />
			{/* Ipape example — slides in from left on step 2 */}
			{showIpape && (
				<div
					key="ipape"
					style={{
						position: "absolute",
						bottom: 80,
						left: 40,
						animation:
							"intro-slide-in-left 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
					}}
				>
					<img
						src="/sprites/pubmon/Ipape_00005_.png"
						alt="Ipape"
						style={{
							width: 96,
							height: 96,
							imageRendering: "pixelated",
							animation: "intro-bob-pkmn 1.2s steps(2) infinite 0.8s",
						}}
					/>
				</div>
			)}
			<IntroDialog key={step} lines={PROF_LINES[step]} onContinue={advance} />
			<div
				style={{
					position: "absolute",
					top: 6,
					right: 8,
					fontFamily: "'Press Start 2P', monospace",
					fontSize: 6,
					color: "#181010",
					background: "rgba(248,248,248,0.7)",
					padding: "2px 4px",
					border: "1px solid #181010",
				}}
			>
				{step + 1}/{PROF_LINES.length}
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// GENDER SCENE
// ═══════════════════════════════════════════════════════════════════
export function GenderScene({
	onPick,
}: {
	onPick: (kind: Gender) => void;
}) {
	const [sel, setSel] = useState(0);

	const genders = [
		{
			id: "boy" as const,
			label: "BOY",
			color: "#4878d0",
			colorDark: "#101828",
			sprite: "red",
		},
		{
			id: "girl" as const,
			label: "GIRL",
			color: "#d04898",
			colorDark: "#601848",
			sprite: "lyra",
		},
		{
			id: "mystery" as const,
			label: "???",
			color: "#7048c0",
			colorDark: "#3a2470",
			sprite: "red",
		},
	];

	const confirm = useCallback(() => {
		onPick(genders[sel].id);
	}, [sel, onPick]);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft")
				setSel((i) => (i - 1 + genders.length) % genders.length);
			else if (e.key === "ArrowRight")
				setSel((i) => (i + 1) % genders.length);
			else if (e.key === "Enter" || e.key === " ") confirm();
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [sel, confirm]);

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<ProfBackground />
			<IntroProfessor mood="bob" style={{ left: 30, transform: "none" }} />
			<div
				style={{
					position: "absolute",
					right: 16,
					top: 52,
					display: "flex",
					flexDirection: "row",
					gap: 8,
				}}
			>
				{genders.map((g, i) => (
					<button
						key={g.id}
						onClick={() => {
							setSel(i);
							setTimeout(confirm, 220);
						}}
						onMouseEnter={() => setSel(i)}
						style={{
							width: 60,
							background: i === sel ? g.color : "#f8f8f8",
							color: i === sel ? "#f8f8f8" : "#282828",
							border: `2px solid ${i === sel ? g.colorDark : "#282828"}`,
							boxShadow:
								i === sel
									? `inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 ${g.colorDark}, 2px 2px 0 rgba(0,0,0,0.4)`
									: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8, 2px 2px 0 rgba(0,0,0,0.4)",
							cursor: "pointer",
							padding: 6,
							fontFamily: "'Press Start 2P', monospace",
							fontSize: 8,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 4,
							borderRadius: 0,
							outline: "none",
							position: "relative",
						}}
					>
						<div
							style={{
								padding: 4,
								background: i === sel ? "rgba(255,255,255,0.4)" : "#d0e8f0",
								border: `1px solid ${i === sel ? "#f8f8f8" : "#181010"}`,
							}}
						>
							<img
								src={getTrainerSpritePath(g.sprite)}
								alt={g.label}
								style={{
									width: 36,
									height: 54,
									imageRendering: "pixelated",
									objectFit: "contain",
									// "???" is an unknown trainer — render as a silhouette
									filter:
										g.id === "mystery"
											? "brightness(0) opacity(0.85)"
											: undefined,
								}}
							/>
						</div>
						<div>{g.label}</div>
						{i === sel && (
							<span
								style={{
									position: "absolute",
									left: 4,
									top: "50%",
									marginTop: -4,
									animation: "intro-blink 0.6s step-end infinite",
									color: "#f8d030",
									fontSize: 8,
								}}
							>
								▶
							</span>
						)}
					</button>
				))}
			</div>
			<IntroDialog
				lines={["Are you a BOY?", "Or are you a GIRL?"]}
				showCursor={false}
			/>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// NAME SCENE
// ═══════════════════════════════════════════════════════════════════
const NAME_MAX = 7;

export function NameScene({
	kind,
	onDone,
	onBack,
}: {
	kind: Gender;
	onDone: (name: string) => void;
	onBack?: () => void;
}) {
	const [name, setName] = useState("");
	const inputRef = useCallback((el: HTMLInputElement | null) => {
		if (el) {
			// Small delay so the scene transition doesn't swallow the focus
			setTimeout(() => el.focus(), 400);
		}
	}, []);

	const finish = () => {
		if (name.trim().length) onDone(name.trim().toUpperCase());
	};

	const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value
			.replace(/[^A-Za-z0-9.-]/g, "")
			.slice(0, NAME_MAX);
		setName(val);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			finish();
		} else if (e.key === "Escape" && onBack) {
			e.preventDefault();
			onBack();
		}
	};

	const PRESETS = ["ASH", "BREW", "RUBY", "JON", "MAX", "ZOE"];

	return (
		<div style={{ position: "absolute", inset: 0, background: "#4878d0" }}>
			{/* Header */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					background: "#101828",
					color: "#f8d030",
					fontFamily: "'Press Start 2P', monospace",
					fontSize: 8,
					padding: "5px 8px",
					borderBottom: "2px solid #f8d030",
					display: "flex",
					justifyContent: "space-between",
				}}
			>
				<span>YOUR NAME?</span>
				<span style={{ color: "#78a8d8" }}>MAX {NAME_MAX}</span>
			</div>
			{/* Trainer card */}
			<div
				style={{
					position: "absolute",
					top: 24,
					left: 8,
					width: 60,
					height: 80,
					background: "#d0e8f0",
					border: "2px solid #181010",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "flex-end",
					padding: 4,
				}}
			>
				<img
					src={getTrainerSpritePath(resolveTrainerSprite(name, kind))}
					alt="Trainer"
					style={{
						width: 48,
						height: 60,
						imageRendering: "pixelated",
						objectFit: "contain",
						// Unknown "???" trainer with no custom portrait → silhouette
						filter:
							kind === "mystery" && !hasCustomTrainerSprite(name)
								? "brightness(0) opacity(0.85)"
								: undefined,
					}}
				/>
				<div
					style={{
						background: "#1830a0",
						color: "#f8f8f8",
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 6,
						padding: "1px 0",
						marginTop: 2,
						width: "100%",
						textAlign: "center",
						border: "1px solid #181010",
					}}
				>
					TRAINER
				</div>
			</div>
			{/* Name slots */}
			<div
				style={{
					position: "absolute",
					top: 30,
					left: 76,
					right: 8,
					display: "flex",
					gap: 3,
					flexWrap: "wrap",
				}}
			>
				{Array.from({ length: NAME_MAX }).map((_, i) => {
					const ch = name[i] || "";
					const here = i === name.length;
					return (
						<div
							key={i}
							style={{
								width: 14,
								height: 18,
								borderBottom: `2px solid ${here ? "#f8d030" : "#a8c8f0"}`,
								fontFamily: "'Press Start 2P', monospace",
								fontSize: 11,
								color: "#f8f8f8",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								animation:
									here && !ch ? "intro-blink 0.6s step-end infinite" : "none",
							}}
						>
							{ch || (here ? "_" : "")}
						</div>
					);
				})}
			</div>
			{/* Quick presets */}
			<div
				style={{
					position: "absolute",
					top: 60,
					left: 76,
					right: 8,
					display: "flex",
					gap: 3,
					flexWrap: "wrap",
				}}
			>
				{PRESETS.map((p) => (
					<button
						key={p}
						onClick={() => setName(p)}
						style={{
							fontFamily: "'Press Start 2P', monospace",
							fontSize: 6,
							padding: "2px 4px",
							background: "#1830a0",
							color: "#a8c8f0",
							border: "1px solid #78a8d8",
							borderRadius: 0,
							cursor: "pointer",
						}}
					>
						{p}
					</button>
				))}
			</div>
			{/* Native text input */}
			<div
				style={{
					position: "absolute",
					bottom: 50,
					left: 6,
					right: 6,
					background: "#f8f8f8",
					border: "2px solid #181010",
					boxShadow: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8",
					padding: "8px 6px",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<input
					ref={inputRef}
					type="text"
					value={name}
					onChange={handleInput}
					onKeyDown={handleKeyDown}
					maxLength={NAME_MAX}
					autoComplete="off"
					autoCorrect="off"
					autoCapitalize="characters"
					spellCheck={false}
					placeholder="TYPE NAME"
					style={{
						width: "100%",
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 12,
						color: "#181010",
						background: "transparent",
						border: "none",
						outline: "none",
						textAlign: "center",
						letterSpacing: 4,
						caretColor: "#f8d030",
					}}
				/>
			</div>
			{/* Action row */}
			<div
				style={{
					position: "absolute",
					bottom: 4,
					left: 6,
					right: 6,
					display: "flex",
					gap: 4,
					justifyContent: "center",
				}}
			>
				{onBack && (
					<IntroButton onClick={onBack} variant="default">
						◀ BACK
					</IntroButton>
				)}
				<IntroButton
					onClick={finish}
					variant="yellow"
					disabled={!name.trim().length}
					style={{ flex: 1, maxWidth: 160 }}
				>
					OK ▶
				</IntroButton>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// CONFIRM NAME SCENE
// ═══════════════════════════════════════════════════════════════════
export function ConfirmNameScene({
	name,
	kind,
	onDone,
}: {
	name: string;
	kind: Gender;
	onDone: () => void;
}) {
	const [step, setStep] = useState(0);
	const lines: [string, string][] = [
		["Right! So your name is", `${name}!`],
		[`${name}! Are you ready`, "to meet your first PUBMON?"],
	];

	const advance = useCallback(() => {
		if (step >= lines.length - 1) onDone();
		else setStep((s) => s + 1);
	}, [step, lines.length, onDone]);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") advance();
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [advance]);

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<ProfBackground />
			<IntroProfessor mood="bob" style={{ left: 30, transform: "none" }} />
			{/* Trainer card */}
			<div
				style={{
					position: "absolute",
					right: 18,
					top: 36,
					width: 84,
					height: 96,
					background: "#f8f8f8",
					border: "2px solid #181010",
					boxShadow:
						"inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8, 2px 2px 0 rgba(0,0,0,0.3)",
					display: "flex",
					flexDirection: "column",
					animation: "intro-pop 0.4s steps(4)",
				}}
			>
				<div
					style={{
						background: "#f85858",
						color: "#f8f8f8",
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 6,
						padding: "2px 4px",
						borderBottom: "2px solid #a82828",
						display: "flex",
						justifyContent: "space-between",
					}}
				>
					<span>TRAINER</span>
					<span>#0001</span>
				</div>
				<div
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "#d0e8f0",
					}}
				>
					<img
						src={getTrainerSpritePath(resolveTrainerSprite(name, kind))}
						alt="Trainer"
						style={{
							width: 56,
							height: 72,
							imageRendering: "pixelated",
							objectFit: "contain",
							// Unknown "???" trainer with no custom portrait → silhouette
							filter:
								kind === "mystery" && !hasCustomTrainerSprite(name)
									? "brightness(0) opacity(0.85)"
									: undefined,
						}}
					/>
				</div>
				<div
					style={{
						background: "#1830a0",
						color: "#f8f8f8",
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 7,
						padding: "2px 4px",
						textAlign: "center",
						borderTop: "1px solid #181010",
					}}
				>
					{name}
				</div>
			</div>
			<IntroDialog key={step} lines={lines[step]} onContinue={advance} />
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// STARTER SCENES
// ═══════════════════════════════════════════════════════════════════

const STARTERS: {
	id: PubType;
	name: string;
	type: string;
	desc: string;
	color: string;
	colorDark: string;
	sprite: string;
	spriteVariant?: number;
	move: string;
}[] = [
	{
		id: "beer",
		name: "HOPPSIN",
		type: "BEER",
		desc: "An EARTH-type pubmon.\nHeavy and dependable.",
		color: "#c28b4a",
		colorDark: "#7c5824",
		sprite: "hoppsin",
		spriteVariant: 2,
		move: "GRAIN SLAM",
	},
	{
		id: "shot",
		name: "TEQUILAR",
		type: "SHOT",
		desc: "A FIRE-type pubmon.\nFast and explosive!",
		color: "#e43b44",
		colorDark: "#8c1c24",
		sprite: "tequilar",
		move: "AGAVE BLAZE",
	},
	{
		id: "wine",
		name: "CHARDERAN",
		type: "WINE",
		desc: "A FAIRY-type pubmon.\nSofts and lulls foes.",
		color: "#f4a4c0",
		colorDark: "#a85478",
		sprite: "charderan",
		spriteVariant: 4,
		move: "OAK CHARM",
	},
	{
		id: "water",
		name: "STILLBAR",
		type: "WATER",
		desc: "A WATER-type pubmon.\nDefensive and refreshing.",
		color: "#63c6e1",
		colorDark: "#2c7894",
		sprite: "stillbar",
		spriteVariant: 3,
		move: "STILL CALM",
	},
	{
		id: "cocktail",
		name: "MARTINI",
		type: "COCKTAIL",
		desc: "A GRASS-type pubmon.\nMixed and tricky.",
		color: "#63c74d",
		colorDark: "#2c7c20",
		sprite: "martini",
		spriteVariant: 5,
		move: "OLIVE TOSS",
	},
];

export function StarterIntroScene({
	name,
	onDone,
}: {
	name: string;
	onDone: () => void;
}) {
	const [step, setStep] = useState(0);
	const lines: [string, string][] = [
		[
			`Now, ${name}, listen carefully.`,
			"In this world, drinks contain PUBMON.",
		],
		["Each one draws out a different", "type of pubmon to battle alongside."],
		[
			"Tradition says every new trainer",
			"picks a STARTER pubmon as a partner.",
		],
		["So, go order a drink!", "Choose your first companion!"],
	];

	const advance = useCallback(() => {
		if (step >= lines.length - 1) onDone();
		else setStep((s) => s + 1);
	}, [step, lines.length, onDone]);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") advance();
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [advance]);

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<ProfBackground />
			<IntroProfessor mood="bob" />
			<IntroDialog key={step} lines={lines[step]} onContinue={advance} />
		</div>
	);
}

export function StarterPickScene({
	onPick,
}: {
	onPick: (starter: (typeof STARTERS)[0]) => void;
}) {
	const [sel, setSel] = useState(2);
	const [opening, setOpening] = useState(false);
	const s = STARTERS[sel];

	const choose = useCallback(() => {
		if (opening) return;
		setOpening(true);
		setTimeout(() => onPick(s), 1100);
	}, [opening, s, onPick]);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (opening) return;
			if (e.key === "ArrowLeft")
				setSel((i) => (i - 1 + STARTERS.length) % STARTERS.length);
			else if (e.key === "ArrowRight") setSel((i) => (i + 1) % STARTERS.length);
			else if (e.key === "Enter" || e.key === " ") choose();
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [sel, opening, choose]);

	const spriteUrl = getPubMonSprite(s.sprite, s.spriteVariant ?? 1);

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			{/* Background */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"linear-gradient(180deg, #182860 0%, #283878 50%, #4878d0 100%)",
				}}
			/>
			{/* Stars */}
			{Array.from({ length: 18 }).map((_, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: (i * 37) % 320,
						top: ((i * 19) % 100) + 8,
						width: 1,
						height: 1,
						background: "#fff",
						opacity: 0.3 + (i % 3) * 0.2,
						animation: `intro-blink ${1.2 + (i % 4) * 0.3}s step-end infinite`,
					}}
				/>
			))}
			{/* Title strip */}
			<div
				style={{
					position: "absolute",
					top: 4,
					left: 4,
					right: 4,
					background: "#101828",
					color: "#f8d030",
					fontFamily: "'Press Start 2P', monospace",
					fontSize: 8,
					padding: "4px 6px",
					border: "2px solid #f8d030",
					textAlign: "center",
					letterSpacing: 1,
					boxShadow: "inset 1px 1px 0 #a88820, inset -1px -1px 0 #181010",
				}}
			>
				CHOOSE YOUR PARTNER
			</div>
			{/* Display panel */}
			<div
				style={{
					position: "absolute",
					top: 28,
					left: 8,
					right: 8,
					height: 100,
					background: "#f8f8f8",
					border: "2px solid #181010",
					boxShadow: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8",
					display: "flex",
					overflow: "hidden",
				}}
			>
				{/* Sprite slot */}
				<div
					style={{
						width: 100,
						height: "100%",
						background: `linear-gradient(180deg, ${s.color}40 0%, ${s.color}80 100%)`,
						borderRight: "2px solid #181010",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						position: "relative",
					}}
				>
					<div
						style={{
							position: "absolute",
							width: 70,
							height: 70,
							background: `radial-gradient(circle, ${s.color}cc 0%, transparent 70%)`,
							borderRadius: "50%",
						}}
					/>
					{opening ? (
						<IntroPokeball
							size={48}
							state="shake"
							style={{
								animation: "intro-pball-shake 0.18s steps(2) infinite",
							}}
						/>
					) : (
						<img
							key={s.id}
							src={spriteUrl}
							alt={s.name}
							style={{
								width: 64,
								height: 64,
								imageRendering: "pixelated",
								animation:
									"intro-pop 0.35s steps(4), intro-bob-pkmn 1.2s steps(2) 0.4s infinite",
								position: "relative",
							}}
						/>
					)}
					<div
						style={{
							position: "absolute",
							top: 4,
							left: 4,
							fontFamily: "'Press Start 2P', monospace",
							fontSize: 6,
							padding: "2px 3px",
							background: s.color,
							color: "#fff",
							border: "1px solid #181010",
							textShadow: "1px 1px 0 #181010",
						}}
					>
						{s.type}
					</div>
				</div>
				{/* Info panel */}
				<div
					style={{
						flex: 1,
						padding: 6,
						display: "flex",
						flexDirection: "column",
						fontFamily: "'Press Start 2P', monospace",
						color: "#181010",
						gap: 4,
					}}
				>
					<div style={{ fontSize: 10 }}>{s.name}</div>
					<div style={{ fontSize: 6, color: s.colorDark }}>
						#{String(sel + 1).padStart(3, "0")} · LV.5
					</div>
					<div
						style={{
							fontSize: 7,
							lineHeight: 1.5,
							color: "#383028",
							whiteSpace: "pre-line",
						}}
					>
						{s.desc}
					</div>
					<div
						style={{
							marginTop: "auto",
							fontSize: 6,
							color: "#181010",
							border: `1px solid ${s.colorDark}`,
							background: `${s.color}33`,
							padding: "2px 4px",
						}}
					>
						MOVE · {s.move}
					</div>
				</div>
			</div>
			{/* Pokeball row */}
			<div
				style={{
					position: "absolute",
					bottom: 56,
					left: 0,
					right: 0,
					display: "flex",
					justifyContent: "center",
					gap: 6,
					padding: "6px 4px",
				}}
			>
				{STARTERS.map((p, i) => {
					const active = i === sel;
					return (
						<button
							key={p.id}
							onClick={() => setSel(i)}
							onDoubleClick={choose}
							onMouseEnter={() => setSel(i)}
							style={{
								background: "transparent",
								border: "none",
								padding: 0,
								cursor: "pointer",
								position: "relative",
								transform: active ? "translateY(-3px)" : "translateY(0)",
								transition: "transform 80ms steps(2)",
							}}
						>
							<IntroPokeball
								size={active ? 26 : 22}
								state={active && !opening ? "shake" : "idle"}
							/>
							{active && (
								<div
									style={{
										position: "absolute",
										left: "50%",
										top: "100%",
										transform: "translateX(-50%)",
										marginTop: 2,
										fontFamily: "'Press Start 2P', monospace",
										fontSize: 6,
										color: p.color,
										textShadow: "1px 1px 0 #181010",
										whiteSpace: "nowrap",
									}}
								>
									{p.type}
								</div>
							)}
						</button>
					);
				})}
			</div>
			{/* Bottom action bar */}
			<div
				style={{
					position: "absolute",
					bottom: 4,
					left: 6,
					right: 6,
					display: "flex",
					gap: 4,
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<div
					style={{
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 6,
						color: "#a8c8f0",
						padding: "0 4px",
					}}
				>
					◀ ▶ to browse
				</div>
				<IntroButton variant="yellow" onClick={choose} disabled={opening}>
					{opening ? "OPENING…" : `TAKE ${s.type} ▶`}
				</IntroButton>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// RECEIVE SCENE
// ═══════════════════════════════════════════════════════════════════
export function ReceiveScene({
	name,
	starter,
	onDone,
}: {
	name: string;
	starter: (typeof STARTERS)[0];
	onDone: () => void;
}) {
	const [phase, setPhase] = useState(0);

	useEffect(() => {
		const t1 = setTimeout(() => setPhase(1), 1200);
		const t2 = setTimeout(() => setPhase(2), 2600);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, []);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (phase === 2 && (e.key === "Enter" || e.key === " ")) onDone();
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [phase, onDone]);

	const spriteUrl = getPubMonSprite(starter.sprite, starter.spriteVariant ?? 1);

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: `radial-gradient(ellipse at center, ${starter.color}cc 0%, ${starter.colorDark} 70%, #101828 100%)`,
				}}
			/>
			{/* Radial rays */}
			{phase >= 1 &&
				Array.from({ length: 12 }).map((_, i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							left: "50%",
							top: "50%",
							width: 200,
							height: 4,
							marginLeft: -100,
							marginTop: -2,
							background: `linear-gradient(90deg, transparent, ${starter.color}55, transparent)`,
							transformOrigin: "50% 50%",
							transform: `rotate(${i * 30}deg)`,
							animation: "intro-blink-slow 1.6s steps(4) infinite",
							animationDelay: `${i * 0.05}s`,
						}}
					/>
				))}
			{phase >= 0 && (
				<IntroSparkles color={starter.color} count={20} radius={80} />
			)}
			{phase >= 1 && <IntroSparkles color="#f8d030" count={14} radius={60} />}
			{/* Center: pokeball → sprite */}
			<div
				style={{
					position: "absolute",
					left: "50%",
					top: 100,
					transform: "translate(-50%, -50%)",
				}}
			>
				{phase < 1 ? (
					<div
						style={{
							animation: "intro-pball-shake 0.18s steps(2) infinite",
						}}
					>
						<IntroPokeball size={48} />
					</div>
				) : (
					<div
						style={{
							animation:
								"intro-encounter-zoom 0.4s steps(6), intro-bob-pkmn 1.2s steps(2) 0.4s infinite",
						}}
					>
						<img
							src={spriteUrl}
							alt={starter.name}
							style={{
								width: 80,
								height: 80,
								imageRendering: "pixelated",
								filter: "drop-shadow(2px 2px 0 #181010)",
							}}
						/>
					</div>
				)}
			</div>
			{/* GOT IT banner */}
			{phase >= 1 && (
				<div
					style={{
						position: "absolute",
						top: 18,
						left: 0,
						right: 0,
						textAlign: "center",
						animation:
							"intro-title-drop 0.5s cubic-bezier(.18,.89,.32,1.28) both",
					}}
				>
					<div
						style={{
							display: "inline-block",
							padding: "4px 10px",
							fontFamily: "'Press Start 2P', monospace",
							fontSize: 12,
							color: "#f8d030",
							background: "#101828",
							border: "2px solid #f8d030",
							textShadow: "1px 1px 0 #a82828",
							letterSpacing: 2,
							boxShadow:
								"inset 1px 1px 0 #a88820, inset -1px -1px 0 #181010, 2px 2px 0 rgba(0,0,0,0.5)",
						}}
					>
						GOT IT!
					</div>
				</div>
			)}
			{phase >= 2 && (
				<IntroDialog
					palette="blue"
					lines={[
						`${name} received ${starter.name}!`,
						"Press ▼ to begin your crawl!",
					]}
					onContinue={onDone}
				/>
			)}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// SENDOFF SCENE
// ═══════════════════════════════════════════════════════════════════
export function SendoffScene({
	name,
	starter,
	onDone,
}: {
	name: string;
	starter: (typeof STARTERS)[0];
	onDone: () => void;
}) {
	const [step, setStep] = useState(0);
	const lines: [string, string][] = [
		["Your very own PUBMON tale", "is about to unfold!"],
		["A world of dreams and adventures", "with PUBMON awaits!"],
		[`Let's go, ${name}!`, "Cheers — and good luck!"],
	];

	const advance = useCallback(() => {
		if (step >= lines.length - 1) onDone();
		else setStep((s) => s + 1);
	}, [step, lines.length, onDone]);

	useEffect(() => {
		const k = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") advance();
		};
		window.addEventListener("keydown", k);
		return () => window.removeEventListener("keydown", k);
	}, [advance]);

	const spriteUrl = getPubMonSprite(starter.sprite, starter.spriteVariant ?? 1);

	const done = step >= lines.length - 1;

	return (
		<div style={{ position: "absolute", inset: 0 }}>
			<ProfBackground />
			<IntroProfessor mood="bob" style={{ left: 30, transform: "none" }} />
			<div
				style={{
					position: "absolute",
					right: 22,
					bottom: 70,
					width: 80,
					height: 80,
					animation: "intro-bob-pkmn 1.2s steps(2) infinite",
				}}
			>
				<img
					src={spriteUrl}
					alt={starter.name}
					style={{
						width: "100%",
						height: "100%",
						imageRendering: "pixelated",
					}}
				/>
			</div>
			<IntroDialog
				key={step}
				lines={lines[step]}
				onContinue={advance}
				showCursor={true}
			/>
			{done && (
				<div
					style={{
						position: "absolute",
						top: 6,
						left: 8,
						fontFamily: "'Press Start 2P', monospace",
						fontSize: 6,
						color: "#181010",
						background: "rgba(248,248,248,0.85)",
						padding: "2px 4px",
						border: "1px solid #181010",
						animation: "intro-blink-slow 1s steps(2) infinite",
					}}
				>
					▶ CRAWL BEGINS
				</div>
			)}
		</div>
	);
}

// Re-export the STARTERS data for use by the orchestrator
export { STARTERS as INTRO_STARTERS };
