"use client";

import { useEffect, useState } from "react";
import { getPubMonSprite, type PubMon } from "@/lib/pokemon-data";
import { PixelBox, PixelButton } from "./pixel-box";
import { PixelSprite, TypeBadge } from "./pixel-sprite";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function StatRow({
	label,
	value,
	accent,
}: {
	label: string;
	value: string;
	accent?: string;
}) {
	return (
		<div className="flex justify-between items-baseline border-b border-dashed border-foreground/20 py-gba-[4] px-gba-[2]">
			<span className=" text-gba-[8] text-foreground/50">{label}</span>
			<span
				className=" text-gba-[8]"
				style={accent ? { color: accent } : undefined}
			>
				{value}
			</span>
		</div>
	);
}

function XPBar({
	from,
	to,
	color = "#3878f8",
}: {
	from: number;
	to: number;
	color?: string;
}) {
	const [width, setWidth] = useState(from);
	useEffect(() => {
		const id = setTimeout(() => setWidth(to), 250);
		return () => clearTimeout(id);
	}, [from, to]);
	return (
		<div
			className="h-gba-[6] border border-foreground"
			style={{ background: "#6870a0" }}
		>
			<div
				style={{
					height: "100%",
					width: `${width * 100}%`,
					background: color,
					transition: "width 1.4s linear",
				}}
			/>
		</div>
	);
}

const PokeBall = ({
	size = 24,
	animated = false,
	style,
}: {
	size?: number;
	animated?: boolean;
	style?: React.CSSProperties;
}) => (
	<img
		src="/sprites/POKEBALL.png"
		width={size}
		height={size}
		alt="pokeball"
		style={{
			imageRendering: "pixelated",
			animation: animated ? "pixel-bounce 1s steps(2,end) infinite" : undefined,
			...style,
		}}
	/>
);

// ─── Run screen (RunB — pub receipt) ─────────────────────────────────────────

function RunScreen({
	ranFromPubmon,
	ranBattleTurns,
	playerPokemon,
	onContinue,
}: {
	ranFromPubmon: PubMon;
	ranBattleTurns: number;
	playerPokemon: PubMon | null;
	onContinue: () => void;
}) {
	const hpTaken = playerPokemon ? playerPokemon.maxHp - playerPokemon.hp : null;

	return (
		<div
			className="flex flex-col items-center gap-gba-[12] px-gba-[14] py-gba-[20]"
			style={{ background: "#262b44", minHeight: "100%" }}
		>
			{/* Receipt card */}
			<div
				className="w-full relative"
				style={{
					background: "#f8f8f8",
					color: "#282828",
					border: "3px solid #181010",
					padding: "10px 12px",
					fontFamily: "inherit",
					boxShadow: "2px 2px 0 0 rgba(0,0,0,0.4)",
					paddingBottom: 20,
				}}
			>
				<div
					className=" text-gba-[9] text-center pb-gba-[6] mb-gba-[8]"
					style={{ borderBottom: "2px dashed #282828" }}
				>
					THE LEAKY TAP
					<br />
					<span className=" text-gba-[7]" style={{ color: "#586878" }}>
						— TAB SUMMARY —
					</span>
				</div>

				<div>
					<div
						className="flex justify-between items-baseline py-gba-[4] px-gba-[2]"
						style={{ borderBottom: "1px dashed #c8c8c8" }}
					>
						<span className=" text-gba-[8]" style={{ color: "#586878" }}>
							OPPONENT
						</span>
						<span className=" text-gba-[8]">
							{ranFromPubmon.name.toUpperCase()}
						</span>
					</div>
					<div
						className="flex justify-between items-baseline py-gba-[4] px-gba-[2]"
						style={{ borderBottom: "1px dashed #c8c8c8" }}
					>
						<span className=" text-gba-[8]" style={{ color: "#586878" }}>
							TURNS
						</span>
						<span className=" text-gba-[8]">{ranBattleTurns}</span>
					</div>
					{hpTaken !== null && (
						<div
							className="flex justify-between items-baseline py-gba-[4] px-gba-[2]"
							style={{ borderBottom: "1px dashed #c8c8c8" }}
						>
							<span className=" text-gba-[8]" style={{ color: "#586878" }}>
								HP TAKEN
							</span>
							<span className=" text-gba-[8]">{hpTaken}</span>
						</div>
					)}
				</div>

				<div
					className="mt-gba-[8] p-gba-[6] text-center  text-gba-[8]"
					style={{ border: "2px solid #282828", background: "#f0e0a0" }}
				>
					STATUS: TAB DODGED ✗
				</div>

				{/* Perforated bottom edge */}
				<div
					style={{
						position: "absolute",
						left: -3,
						right: -3,
						bottom: -10,
						height: 10,
						background:
							"repeating-linear-gradient(90deg, #f8f8f8 0 8px, transparent 8px 14px)",
					}}
				/>
			</div>

			<p
				className=" text-gba-[10] text-center"
				style={{ color: "#f8d030", lineHeight: 1.6 }}
			>
				GOT AWAY SAFELY!
			</p>
			<p
				className=" text-gba-[7] text-center"
				style={{ color: "#a8b0b8", lineHeight: 1.7 }}
			>
				Slipped out the back before
				<br />
				the bouncer could clock you.
			</p>

			<PixelButton variant="default" onClick={onContinue} className="w-full">
				BACK TO CRAWL
			</PixelButton>
		</div>
	);
}

// ─── Catch screen (CatchB — PUBDEX entry card) ───────────────────────────────

function CatchScreen({
	caughtPokemon,
	onContinue,
}: {
	caughtPokemon: PubMon;
	onContinue: () => void;
}) {
	const spriteUrl = getPubMonSprite(
		caughtPokemon.sprite,
		caughtPokemon.spriteVariant ?? 1,
	);
	const entryNumber = String(caughtPokemon.id).padStart(4, "0");
	const today = new Date()
		.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
		})
		.toUpperCase();

	return (
		<div
			className="flex flex-col gap-gba-[10] px-gba-[12] py-gba-[12]"
			style={{ background: "#d03838", minHeight: "100%" }}
		>
			{/* PUBDEX +1 header */}
			<div
				className="text-center  text-gba-[11]"
				style={{
					color: "#f8d030",
					textShadow: "2px 2px 0 #a82828",
					padding: "4px 0",
				}}
			>
				PUBDEX +1
			</div>

			{/* Entry card */}
			<div
				className="relative"
				style={{
					background: "#f8f8f8",
					border: "3px solid #181010",
					padding: 10,
					boxShadow:
						"inset 2px 2px 0 #fff, inset -2px -2px 0 #a8b0b8, 2px 2px 0 0 rgba(0,0,0,0.5)",
				}}
			>
				{/* Blue header strip */}
				<div
					className=" text-gba-[8] mb-gba-[8] flex justify-between"
					style={{
						background: "#4878d0",
						color: "#f8f8f8",
						padding: "4px 8px",
						border: "2px solid #305098",
					}}
				>
					<span>PUBDEX ENTRY</span>
					<span>#{entryNumber}</span>
				</div>

				{/* Sprite + info row */}
				<div className="flex gap-gba-[10]">
					<div
						className="relative flex-shrink-0 flex items-center justify-center"
						style={{
							width: 80,
							height: 80,
							background: "#d0e8f0",
							border: "2px solid #282828",
						}}
					>
						<img
							src={spriteUrl}
							alt={caughtPokemon.name}
							style={{ width: 64, height: 64, imageRendering: "pixelated" }}
						/>
						<div style={{ position: "absolute", right: 3, top: 3 }}>
							<PokeBall size={14} />
						</div>
					</div>

					<div className="flex flex-col gap-gba-[4] flex-1">
						<div className=" text-gba-[11]" style={{ color: "#282828" }}>
							{caughtPokemon.name.toUpperCase()}
						</div>
						<div className="flex gap-gba-[4]">
							<TypeBadge type={caughtPokemon.type} />
						</div>
						<div
							className=" text-gba-[7]"
							style={{ color: "#586878", lineHeight: 1.5 }}
						>
							{caughtPokemon.description.slice(0, 40).toUpperCase()}
						</div>
					</div>
				</div>

				{/* Stats */}
				<div
					className="mt-gba-[10] pt-gba-[8]"
					style={{ borderTop: "2px dashed #a8b0b8" }}
				>
					<div
						className="flex justify-between items-baseline py-gba-[4] px-gba-[2]"
						style={{ borderBottom: "1px dashed #c8c8c8" }}
					>
						<span className=" text-gba-[8]" style={{ color: "#586878" }}>
							LEVEL
						</span>
						<span className=" text-gba-[8]">LV.{caughtPokemon.level}</span>
					</div>
					<div
						className="flex justify-between items-baseline py-gba-[4] px-gba-[2]"
						style={{ borderBottom: "1px dashed #c8c8c8" }}
					>
						<span className=" text-gba-[8]" style={{ color: "#586878" }}>
							HP
						</span>
						<span className=" text-gba-[8]">
							{caughtPokemon.hp} / {caughtPokemon.maxHp}
						</span>
					</div>
					<div className="flex justify-between items-baseline py-gba-[4] px-gba-[2]">
						<span className=" text-gba-[8]" style={{ color: "#586878" }}>
							DATE
						</span>
						<span className=" text-gba-[8]">{today}</span>
					</div>
				</div>

				{/* REGISTERED stamp */}
				<div
					className=" text-gba-[9] absolute"
					style={{
						right: -6,
						bottom: 14,
						background: "#50b058",
						color: "#fff",
						padding: "5px 8px",
						border: "2px solid #2c7a3d",
						transform: "rotate(-8deg)",
						boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)",
					}}
				>
					REGISTERED
				</div>
			</div>

			<PixelButton variant="primary" onClick={onContinue} className="w-full">
				CONTINUE CRAWL
			</PixelButton>
		</div>
	);
}

// ─── Win / XP screen (WinC — level up + stat gains) ──────────────────────────

function WinScreen({
	xpGained,
	activePokemon,
	defeatedPokemon,
	onContinue,
}: {
	xpGained: number;
	activePokemon: PubMon | null;
	defeatedPokemon: PubMon | null;
	onContinue: () => void;
}) {
	// Normalise XP bar: use level * 100 as a rough threshold
	const xpThreshold = activePokemon ? activePokemon.level * 100 : 100;
	const previousXp = activePokemon
		? Math.max(0, activePokemon.xp - xpGained)
		: 0;
	const xpFrom = Math.min(previousXp / xpThreshold, 1);
	const xpTo = Math.min((activePokemon?.xp ?? 0) / xpThreshold, 1);

	const stats = activePokemon
		? [
				{ label: "HP", value: activePokemon.hp },
				{ label: "ATK", value: activePokemon.attack },
				{ label: "DEF", value: activePokemon.defense },
			]
		: [];

	return (
		<div
			className="flex flex-col items-center gap-gba-[10] px-gba-[12] py-gba-[12]"
			style={{ background: "#1a1c2c", minHeight: "100%" }}
		>
			{/* Victory banner */}
			<div
				className="w-full text-center border-gba-[1] border-foreground px-gba-[10] py-gba-[8]"
				style={{
					background: "#f8d030",
					boxShadow:
						"inset 2px 2px 0 rgba(255,255,255,0.5), inset -2px -2px 0 rgba(168,136,32,0.7), 3px 3px 0 0 rgba(0,0,0,0.3)",
					animation: "banner-flash 1.4s steps(3,end) infinite",
				}}
			>
				<div
					className="text-gba-[14]"
					style={{ color: "#181010", letterSpacing: 1.5 }}
				>
					VICTORY!
				</div>
				{defeatedPokemon && (
					<div className="text-gba-[8] mt-gba-[4]" style={{ color: "#5a4818" }}>
						{defeatedPokemon.name.toUpperCase()} WAS DEFEATED
					</div>
				)}
			</div>

			{/* Sprite + XP bar */}
			{activePokemon && (
				<PixelBox className="w-full p-gba-[8]">
					<div className="flex gap-gba-[10] items-center">
						<div className="flex-shrink-0 flex items-center justify-center w-gba-[72] h-gba-[72] bg-secondary border-gba-[1] border-foreground">
							<PixelSprite
								name={activePokemon.sprite}
								variant={activePokemon.spriteVariant ?? 1}
								size={64}
								animated
							/>
						</div>
						<div className="flex-1">
							<div className="text-gba-[8] text-foreground/60 mb-gba-[4]">
								EXP TO NEXT
							</div>
							<XPBar from={xpFrom} to={xpTo} />
							<div className="flex justify-between text-gba-[7] text-foreground/60 mt-gba-[4]">
								<span>+{xpGained} XP</span>
								<span>{activePokemon.xp} XP</span>
							</div>
						</div>
					</div>
				</PixelBox>
			)}

			{/* Stat display */}
			{stats.length > 0 && (
				<PixelBox className="w-full p-gba-[8]">
					<div className="text-gba-[8] text-foreground/60 mb-gba-[6]">
						STATS
					</div>
					{stats.map((s, i) => (
						<div
							key={s.label}
							className="flex items-center gap-gba-[6] py-gba-[3] text-gba-[8] border-foreground/20"
							style={{
								borderBottom: i < stats.length - 1 ? "1px dashed" : "none",
							}}
						>
							<span className="text-foreground/50 w-gba-[36]">{s.label}</span>
							<span>{s.value}</span>
						</div>
					))}
				</PixelBox>
			)}

			<PixelButton variant="primary" onClick={onContinue} className="w-full">
				CONTINUE CRAWL
			</PixelButton>
		</div>
	);
}

// ─── Public API ───────────────────────────────────────────────────────────────

type PostBattleProps =
	| {
			variant: "caught";
			onContinue: () => void;
			caughtPokemon: PubMon;
	  }
	| {
			variant: "xpGain";
			onContinue: () => void;
			xpGained: number;
			activePokemon: PubMon | null;
			defeatedPokemon: PubMon | null;
	  }
	| {
			variant: "ran";
			onContinue: () => void;
			ranFromPubmon: PubMon;
			ranBattleTurns: number;
			playerPokemon: PubMon | null;
	  };

export function PostBattle(props: PostBattleProps) {
	if (props.variant === "caught") {
		return (
			<CatchScreen
				caughtPokemon={props.caughtPokemon}
				onContinue={props.onContinue}
			/>
		);
	}
	if (props.variant === "xpGain") {
		return (
			<WinScreen
				xpGained={props.xpGained}
				activePokemon={props.activePokemon}
				defeatedPokemon={props.defeatedPokemon}
				onContinue={props.onContinue}
			/>
		);
	}
	return (
		<RunScreen
			ranFromPubmon={props.ranFromPubmon}
			ranBattleTurns={props.ranBattleTurns}
			playerPokemon={props.playerPokemon}
			onContinue={props.onContinue}
		/>
	);
}
