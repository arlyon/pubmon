"use client";

import React, { useEffect, useState } from "react";

// ─────────────────────────────────── GBA Stage wrapper
// Renders children inside a 320×240 pixel-perfect viewport scaled to fit
export function GBAStage({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		const stage = document.getElementById("intro-stage");
		if (!stage) return;
		const fit = () => {
			const wrap = stage.parentElement;
			if (!wrap) return;
			const W = wrap.clientWidth - 32;
			const H = wrap.clientHeight - 80;
			const scale = Math.max(1, Math.floor(Math.min(W / 320, H / 240)));
			stage.style.transform = `scale(${scale})`;
		};
		fit();
		window.addEventListener("resize", fit);
		return () => window.removeEventListener("resize", fit);
	}, []);

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background:
					"radial-gradient(ellipse at center, #1a1c2c 0%, #07080f 100%)",
				zIndex: 50,
			}}
		>
			<div
				id="intro-stage"
				className="intro-stage"
				style={{
					width: 320,
					height: 240,
					position: "relative",
					background: "#000",
					overflow: "hidden",
					imageRendering: "pixelated",
					boxShadow:
						"0 0 0 4px #1a1c2c, 0 0 0 8px #2c2e3c, 0 0 0 10px #0a0a14, 0 30px 60px -10px rgba(0,0,0,0.8), 0 0 80px rgba(72,120,208,0.18)",
					transformOrigin: "center",
				}}
			>
				{children}
				{/* Scanlines overlay */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						pointerEvents: "none",
						background:
							"repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)",
						zIndex: 999,
						mixBlendMode: "multiply",
					}}
				/>
			</div>
		</div>
	);
}

// ─────────────────────────────────── Typewriter dialog box
interface IntroDialogProps {
	lines: [string, string];
	speed?: number;
	onContinue?: () => void;
	showCursor?: boolean;
	palette?: "default" | "blue";
}

export function IntroDialog({
	lines,
	speed = 28,
	onContinue,
	showCursor = true,
	palette = "default",
}: IntroDialogProps) {
	const [shown, setShown] = useState(["", ""]);
	const [done, setDone] = useState(false);
	const fullText = lines.slice(0, 2);
	const cancelRef = React.useRef(false);

	useEffect(() => {
		setShown(["", ""]);
		setDone(false);
		cancelRef.current = false;
		let li = 0;
		let ci = 0;
		const tick = () => {
			if (cancelRef.current) return;
			if (li >= fullText.length) {
				setDone(true);
				return;
			}
			const cur = fullText[li] || "";
			if (ci >= cur.length) {
				li++;
				ci = 0;
				setTimeout(tick, 60);
				return;
			}
			ci++;
			const capturedLi = li;
			const capturedCi = ci;
			setShown((s) => {
				const next = [...s];
				next[capturedLi] = cur.slice(0, capturedCi);
				return next;
			});
			setTimeout(tick, speed);
		};
		setTimeout(tick, 80);
		return () => {
			cancelRef.current = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fullText.join("|"), speed]);

	const skipOrAdvance = (e?: React.MouseEvent) => {
		if (e) e.stopPropagation();
		if (!done) {
			cancelRef.current = true;
			setShown([...fullText]);
			setDone(true);
		} else if (onContinue) {
			onContinue();
		}
	};

	return (
		<div
			onClick={skipOrAdvance}
			style={{
				position: "absolute",
				left: 6,
				right: 6,
				bottom: 6,
				background: palette === "blue" ? "#1830a0" : "#f8f8f8",
				color: palette === "blue" ? "#f8f8f8" : "#282828",
				border: `2px solid ${palette === "blue" ? "#78a8d8" : "#282828"}`,
				boxShadow:
					palette === "blue"
						? "inset 2px 2px 0 #4878d0, inset -2px -2px 0 #101828"
						: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8",
				padding: "8px 10px",
				minHeight: 50,
				cursor: "pointer",
				userSelect: "none",
			}}
		>
			<div
				style={{
					fontFamily: "'Press Start 2P', monospace",
					fontSize: 8,
					lineHeight: 1.7,
					whiteSpace: "pre",
				}}
			>
				{shown[0] || "\u00a0"}
				{"\n"}
				{shown[1] || "\u00a0"}
			</div>
			{showCursor && done && (
				<span
					style={{
						position: "absolute",
						right: 8,
						bottom: 6,
						fontSize: 8,
						animation: "intro-blink 0.6s step-end infinite",
						color: palette === "blue" ? "#f8d030" : "#282828",
					}}
				>
					▼
				</span>
			)}
		</div>
	);
}

// ─────────────────────────────────── Pixel button
interface IntroButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	variant?: "default" | "primary" | "yellow" | "red" | "green";
	disabled?: boolean;
	selected?: boolean;
	style?: React.CSSProperties;
}

export function IntroButton({
	children,
	onClick,
	variant = "default",
	disabled = false,
	selected = false,
	style = {},
}: IntroButtonProps) {
	const palettes = {
		default: {
			bg: "#f8f8f8",
			fg: "#282828",
			bc: "#282828",
			hi: "#fff",
			lo: "#a8b0b8",
		},
		primary: {
			bg: "#4878d0",
			fg: "#f8f8f8",
			bc: "#101828",
			hi: "#78a8e8",
			lo: "#305098",
		},
		yellow: {
			bg: "#f8d030",
			fg: "#282828",
			bc: "#a88820",
			hi: "#fce078",
			lo: "#a88820",
		},
		red: {
			bg: "#d03838",
			fg: "#f8f8f8",
			bc: "#181010",
			hi: "#f87878",
			lo: "#a82828",
		},
		green: {
			bg: "#50b058",
			fg: "#f8f8f8",
			bc: "#181010",
			hi: "#80d088",
			lo: "#308840",
		},
	};
	const p = palettes[variant];

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			style={{
				fontFamily: "'Press Start 2P', monospace",
				fontSize: 8,
				padding: "5px 8px",
				background: p.bg,
				color: p.fg,
				border: `2px solid ${p.bc}`,
				borderRadius: 0,
				boxShadow: `inset 1px 1px 0 ${p.hi}, inset -1px -1px 0 ${p.lo}, 1px 1px 0 0 rgba(0,0,0,0.4)`,
				cursor: disabled ? "default" : "pointer",
				opacity: disabled ? 0.5 : 1,
				outline: selected ? "2px solid #f8d030" : "none",
				outlineOffset: selected ? 1 : 0,
				...style,
			}}
		>
			{children}
		</button>
	);
}

// ─────────────────────────────────── Pokeball (PNG sprite)
interface PokeballProps {
	size?: number;
	state?: "idle" | "shake" | "spin";
	style?: React.CSSProperties;
}

export function IntroPokeball({
	size = 32,
	state = "idle",
	style = {},
}: PokeballProps) {
	const anim =
		state === "shake"
			? "intro-pball-shake 0.5s steps(8) infinite"
			: state === "spin"
				? "intro-pball-spin 1s linear infinite"
				: undefined;

	return (
		<img
			src="/sprites/POKEBALL.png"
			alt="Pokeball"
			width={size}
			height={size}
			style={{
				imageRendering: "pixelated",
				animation: anim,
				transformOrigin: "center",
				...style,
			}}
		/>
	);
}

// ─────────────────────────────────── Sparkle particles
export function IntroSparkles({
	color = "#f8d030",
	count = 16,
	radius = 60,
}: {
	color?: string;
	count?: number;
	radius?: number;
}) {
	const points = Array.from({ length: count }, (_, i) => {
		const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
		const r = radius * (0.7 + Math.random() * 0.5);
		return {
			tx: Math.cos(angle) * r,
			ty: Math.sin(angle) * r,
			delay: Math.random() * 0.3,
			size: 2 + Math.random() * 2,
		};
	});

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{points.map((p, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						top: "50%",
						left: "50%",
						width: p.size,
						height: p.size,
						background: color,
						marginLeft: -p.size / 2,
						marginTop: -p.size / 2,
						animation: `intro-sparkle-out 1.4s ${p.delay}s steps(8) forwards`,
						["--tx" as string]: `${p.tx}px`,
						["--ty" as string]: `${p.ty}px`,
					}}
				/>
			))}
		</div>
	);
}

// ─────────────────────────────────── Professor background
export function ProfBackground() {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(180deg, #d8f0d0 0%, #a8e0c0 35%, #58a888 75%, #387868 100%)",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 130,
					height: 1,
					background: "rgba(0,0,0,0.15)",
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					bottom: 30,
					height: 6,
					backgroundImage:
						"repeating-linear-gradient(90deg, rgba(40,60,50,0.2) 0, rgba(40,60,50,0.2) 2px, transparent 2px, transparent 6px)",
				}}
			/>
		</div>
	);
}

// ─────────────────────────────────── Professor sprite
export function IntroProfessor({
	entering = false,
	mood = "idle",
	style = {},
}: {
	entering?: boolean;
	mood?: "idle" | "bob" | "shake";
	style?: React.CSSProperties;
}) {
	return (
		<div
			style={{
				position: "absolute",
				bottom: 60,
				left: "50%",
				transform: "translateX(-50%)",
				width: 70,
				height: 110,
				animation: entering
					? "intro-slide-in-right 0.7s steps(6) both"
					: mood === "bob"
						? "intro-bob 1.4s steps(2) infinite"
						: undefined,
				...style,
			}}
		>
			<img
				src="/sprites/pubtrainers/profbarley.png"
				alt="Professor Barley"
				style={{
					width: "100%",
					height: "100%",
					imageRendering: "pixelated",
					objectFit: "contain",
				}}
			/>
		</div>
	);
}

// ─────────────────────────────────── CSS keyframes (injected once)
let stylesInjected = false;
export function IntroStyles() {
	useEffect(() => {
		if (stylesInjected) return;
		stylesInjected = true;
		const style = document.createElement("style");
		style.textContent = `
      @keyframes intro-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
      @keyframes intro-blink-slow { 0%,60% { opacity: 1; } 61%,100% { opacity: 0; } }
      @keyframes intro-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
      @keyframes intro-bob-pkmn { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      @keyframes intro-pball-spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
      @keyframes intro-pball-shake {
        0%,100% { transform: rotate(0); }
        15% { transform: rotate(-15deg); }
        35% { transform: rotate(15deg); }
        55% { transform: rotate(-15deg); }
        75% { transform: rotate(15deg); }
      }
      @keyframes intro-pop {
        0% { transform: scale(0); }
        60% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      @keyframes intro-title-drop {
        0% { transform: translateY(-80px) scale(0.9); opacity: 0; }
        60% { transform: translateY(4px) scale(1); opacity: 1; }
        80% { transform: translateY(-2px) scale(1); }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes intro-title-flash {
        0%, 100% { filter: brightness(1); }
        20% { filter: brightness(1.6) drop-shadow(0 0 4px #fff); }
      }
      @keyframes intro-slide-in-right {
        0% { transform: translateX(160px); opacity: 0; }
        60% { opacity: 1; }
        100% { transform: translateX(0); opacity: 1; }
      }
      @keyframes intro-slide-in-left {
        0% { transform: translateX(-80px); opacity: 0; }
        40% { opacity: 1; }
        100% { transform: translateX(0); opacity: 1; }
      }
      @keyframes intro-flash-white {
        0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; }
      }
      @keyframes intro-sparkle-out {
        0% { transform: translate(0,0) scale(0); opacity: 1; }
        50% { opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0; }
      }
      @keyframes intro-encounter-zoom {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes intro-cry-pan {
        0% { transform: translateX(240px) scale(0.9); opacity: 0; }
        8% { opacity: 1; }
        100% { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes intro-cry-shake {
        0%, 100% { transform: translate(0, 0); }
        20% { transform: translate(-3px, 1px); }
        40% { transform: translate(2px, -2px); }
        60% { transform: translate(-1px, 2px); }
        80% { transform: translate(3px, -1px); }
      }
      @keyframes intro-cry-flash {
        0% { opacity: 0; }
        15% { opacity: 1; }
        100% { opacity: 0; }
      }
      .intro-stage, .intro-stage * {
        image-rendering: pixelated;
        -webkit-font-smoothing: none;
      }
    `;
		document.head.appendChild(style);
		return () => {
			// Don't remove — may be re-mounted
		};
	}, []);
	return null;
}
