// PostBattle.jsx — Post-battle screen variants for PubMon
// Three outcomes × three variants each: RUN, CATCH, WIN.
// All screens are 320×568 (logical GBA-ish viewport).

// ─────────────────────────────────────────────────────────── helpers
const ps2p = "'Press Start 2P', monospace";

// Re-usable mini-pokeball sprite. Pixel-art via inline rects.
const PokeBall = ({
	size = 24,
	animate = false,
	broken = false,
	style = {},
}) => (
	<svg
		viewBox="0 0 10 10"
		width={size}
		height={size}
		shapeRendering="crispEdges"
		style={{
			imageRendering: "pixelated",
			animation: animate ? "pixel-bounce 1s steps(2,end) infinite" : undefined,
			...style,
		}}
	>
		<circle cx={5} cy={5} r={4.5} fill="#e43b44" />
		<rect x={0.5} y={4.5} width={9} height={1} fill="#1a1c2c" />
		<circle
			cx={5}
			cy={5}
			r={4.5}
			fill="none"
			stroke="#1a1c2c"
			strokeWidth={0.5}
		/>
		<rect
			x={0.5}
			y={5}
			width={9}
			height={4.5}
			rx={broken ? 0 : 4.5}
			fill="#f4f4f4"
		/>
		<circle
			cx={5}
			cy={5}
			r={1.2}
			fill="#f4f4f4"
			stroke="#1a1c2c"
			strokeWidth={0.4}
		/>
		<circle cx={5} cy={5} r={0.6} fill="#1a1c2c" />
	</svg>
);

// Confetti / sparkle pixel-bursts behind a center sprite.
const PixelBurst = ({ count = 14, color = "#f8d030" }) => {
	const dots = React.useMemo(() => {
		const out = [];
		for (let i = 0; i < count; i++) {
			const a = (i / count) * Math.PI * 2 + (i % 2 ? 0.2 : -0.2);
			const r = 70 + (i % 3) * 14;
			out.push({
				x: Math.cos(a) * r,
				y: Math.sin(a) * r,
				s: 4 + (i % 3) * 2,
				c: i % 2 ? color : "#f8f8f8",
				d: i * 60,
			});
		}
		return out;
	}, [count, color]);
	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{dots.map((p, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: "50%",
						top: "50%",
						width: p.s,
						height: p.s,
						background: p.c,
						transform: `translate(${p.x}px, ${p.y}px)`,
						animation: `spark-pop 1.2s steps(4,end) ${p.d}ms infinite`,
					}}
				/>
			))}
		</div>
	);
};

// Phone frame/screen wrapper for each variant.
const Screen = ({ children, bg = "#d8e0e8" }) => (
	<div
		className="pixel-perfect"
		style={{
			width: 320,
			height: 568,
			background: bg,
			display: "flex",
			flexDirection: "column",
			overflow: "hidden",
			border: "4px solid #181010",
			boxShadow: "0 6px 0 0 rgba(0,0,0,0.15), 0 18px 40px rgba(0,0,0,0.25)",
			fontFamily: "'Emerald','Press Start 2P',monospace",
		}}
	>
		{children}
	</div>
);

// Compact battle-header for context above results.
const BattleHeader = ({ result = "VICTORY" }) => {
	const m = {
		VICTORY: { bg: "#4878d0", border: "#305098", icon: "" },
		CAUGHT: { bg: "#50b058", border: "#2c7a3d", icon: "●" },
		FLED: { bg: "#7a8090", border: "#404858", icon: "»" },
	}[result];
	return (
		<div
			style={{
				background: m.bg,
				borderBottom: `3px solid ${m.border}`,
				color: "#f8f8f8",
				padding: "8px 12px",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				fontFamily: ps2p,
				fontSize: 9,
				boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.18), inset -2px -2px 0 rgba(0,0,0,0.25)`,
			}}
		>
			<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<span style={{ fontSize: 11 }}>{m.icon}</span>
				BATTLE — {result}
			</span>
			<span style={{ fontSize: 8, opacity: 0.85 }}>THE LEAKY TAP</span>
		</div>
	);
};

const Continue = ({
	children = "CONTINUE CRAWL",
	variant = "primary",
	onClick,
}) => (
	<PixelButton
		variant={variant}
		onClick={onClick}
		style={{ width: "100%", padding: "12px 14px", fontSize: 10 }}
	>
		{children}
	</PixelButton>
);

// Stat row (label · value)
const StatRow = ({ label, value, accent }) => (
	<div
		style={{
			display: "flex",
			justifyContent: "space-between",
			alignItems: "baseline",
			fontFamily: ps2p,
			fontSize: 8,
			lineHeight: 1.4,
			borderBottom: "1px dashed #a8b0b8",
			padding: "4px 2px",
		}}
	>
		<span style={{ color: "#586878" }}>{label}</span>
		<span style={{ color: accent || "#282828" }}>{value}</span>
	</div>
);

// XP bar (animated fill from -> to)
const XPBar = ({ from = 0.2, to = 0.78, color = "#3878f8", height = 6 }) => {
	const [w, setW] = React.useState(from);
	React.useEffect(() => {
		const id = setTimeout(() => setW(to), 250);
		return () => clearTimeout(id);
	}, [from, to]);
	return (
		<div style={{ height, background: "#6870a0", border: "1px solid #181010" }}>
			<div
				style={{
					height: "100%",
					width: `${w * 100}%`,
					background: color,
					transition: "width 1.4s linear",
				}}
			/>
		</div>
	);
};

// ───────────────────────────────────────────────────────────────────
//                          R U N   A W A Y
// ───────────────────────────────────────────────────────────────────

// A · Classic GBA "Got away safely" — dialog box + dust trail.
const RunA = () => (
	<Screen>
		<BattleHeader result="FLED" />
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				padding: 12,
				gap: 12,
			}}
		>
			{/* Empty battlefield with dust */}
			<div
				style={{
					flex: 1,
					background: "#f0e0a0",
					border: "3px solid #282828",
					position: "relative",
					boxShadow: "inset 2px 2px 0 #f8e8b0, inset -2px -2px 0 #c8a878",
					overflow: "hidden",
				}}
			>
				{/* horizon */}
				<div
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: "55%",
						height: 2,
						background: "#a88858",
					}}
				/>
				{/* dust puffs */}
				{[0, 1, 2].map((i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							left: 24 + i * 28,
							bottom: 36,
							width: 18 - i * 2,
							height: 10 - i * 2,
							background: "#f8f8f8",
							border: "2px solid #282828",
							borderRadius: 0,
							opacity: 1 - i * 0.25,
							animation: `dust-puff 1.2s steps(3,end) ${i * 200}ms infinite`,
						}}
					/>
				))}
				{/* receding sprite footprint */}
				<div
					style={{
						position: "absolute",
						right: 14,
						bottom: 24,
						fontFamily: ps2p,
						fontSize: 9,
						color: "#583028",
					}}
				>
					»»»
				</div>
				{/* tiny shadow where opponent was */}
				<div
					style={{
						position: "absolute",
						left: 28,
						bottom: 22,
						width: 56,
						height: 6,
						background: "#a88858",
						borderRadius: "50%",
					}}
				/>
			</div>

			<PixelDialog showContinue={false}>
				Got away safely!
				<br />
				<span style={{ color: "#a8b0b8", fontSize: 10 }}>
					ASH ducked out the back.
				</span>
			</PixelDialog>

			<Continue variant="default">RETURN TO CRAWL</Continue>
		</div>
	</Screen>
);

// B · Pub-flavored receipt: "Tab dodged"
const RunB = () => (
	<Screen bg="#262b44">
		<BattleHeader result="FLED" />
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				padding: 14,
				gap: 12,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{/* Receipt */}
			<div
				style={{
					width: "100%",
					background: "#f8f8f8",
					color: "#282828",
					border: "3px solid #181010",
					padding: "10px 12px",
					fontFamily: ps2p,
					fontSize: 9,
					lineHeight: 1.6,
					position: "relative",
					boxShadow: "2px 2px 0 0 rgba(0,0,0,0.4)",
				}}
			>
				<div
					style={{
						textAlign: "center",
						borderBottom: "2px dashed #282828",
						paddingBottom: 6,
						marginBottom: 8,
					}}
				>
					THE LEAKY TAP
					<br />
					<span style={{ fontSize: 7, color: "#586878" }}>— TAB SUMMARY —</span>
				</div>
				<StatRow label="OPPONENT" value="GASTLY ♂" />
				<StatRow label="TURNS" value="4" />
				<StatRow label="HP TAKEN" value="18" />
				<StatRow label="DRINKS" value="2 BEER" />
				<div
					style={{
						marginTop: 8,
						padding: 6,
						border: "2px solid #282828",
						background: "#f0e0a0",
						textAlign: "center",
						fontSize: 8,
					}}
				>
					STATUS: TAB DODGED ✗
				</div>
				{/* perforated edge */}
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

			<div
				style={{
					color: "#f8d030",
					fontFamily: ps2p,
					fontSize: 10,
					textAlign: "center",
					lineHeight: 1.6,
				}}
			>
				GOT AWAY SAFELY!
			</div>
			<div
				style={{
					color: "#a8b0b8",
					fontFamily: ps2p,
					fontSize: 7,
					textAlign: "center",
					lineHeight: 1.7,
				}}
			>
				Slipped out the back before
				<br />
				the bouncer could clock you.
			</div>

			<Continue variant="yellow">BACK TO CRAWL</Continue>
		</div>
	</Screen>
);

// C · Stat summary — what the encounter cost
const RunC = () => (
	<Screen>
		<BattleHeader result="FLED" />
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				padding: 12,
				gap: 10,
			}}
		>
			<PixelBox style={{ padding: 0, overflow: "hidden" }}>
				<div
					style={{
						background: "#7a8090",
						color: "#f8f8f8",
						padding: "5px 8px",
						fontFamily: ps2p,
						fontSize: 9,
						borderBottom: "2px solid #282828",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<span>RUN AWAY</span>
					<span style={{ fontSize: 7, opacity: 0.8 }}>ENCOUNTER #047</span>
				</div>

				<div
					style={{
						padding: 10,
						display: "flex",
						gap: 12,
						alignItems: "center",
					}}
				>
					<div
						style={{
							width: 64,
							height: 64,
							background: "#a8b0b8",
							border: "2px solid #282828",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							position: "relative",
							overflow: "hidden",
						}}
					>
						<img
							src="assets/sprites/gastly.png"
							style={{
								width: 56,
								height: 56,
								imageRendering: "pixelated",
								filter: "grayscale(1) opacity(0.55)",
							}}
						/>
						<div
							style={{
								position: "absolute",
								inset: 0,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontFamily: ps2p,
								fontSize: 24,
								color: "#d03838",
								textShadow: "1px 1px 0 #fff",
							}}
						>
							?
						</div>
					</div>
					<div style={{ flex: 1 }}>
						<div style={{ fontFamily: ps2p, fontSize: 10, color: "#282828" }}>
							UNRECORDED
						</div>
						<div
							style={{
								fontFamily: ps2p,
								fontSize: 7,
								color: "#586878",
								marginTop: 4,
								lineHeight: 1.5,
							}}
						>
							No PUBDEX entry — fled the
							<br />
							encounter before scanning.
						</div>
					</div>
				</div>
			</PixelBox>

			<PixelBox style={{ padding: 8 }}>
				<div
					style={{
						fontFamily: ps2p,
						fontSize: 8,
						color: "#586878",
						marginBottom: 6,
					}}
				>
					WHAT YOU LOST
				</div>
				<StatRow label="XP MISSED" value="~ 64 XP" accent="#d03838" />
				<StatRow label="POSSIBLE DROPS" value="2 ITEMS" />
				<StatRow label="TURNS WASTED" value="4" />
			</PixelBox>

			<PixelDialog showContinue={false}>
				BULBASPRITZ got away safely!
			</PixelDialog>

			<Continue>RETURN TO CRAWL</Continue>
		</div>
	</Screen>
);

// ───────────────────────────────────────────────────────────────────
//                          C A P T U R E
// ───────────────────────────────────────────────────────────────────

// A · Faithful reproduction of the source snippet — large pokeball + GOTCHA
const CatchA = () => (
	<Screen>
		<BattleHeader result="CAUGHT" />
		<div
			style={{
				flex: 1,
				padding: 14,
				display: "flex",
				flexDirection: "column",
				gap: 12,
				alignItems: "center",
				justifyContent: "flex-start",
			}}
		>
			<PixelBox variant="default" className="w-full" style={{ width: "100%" }}>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 12,
						padding: "8px 4px",
					}}
				>
					{/* Pokeball framed in type color */}
					<div
						style={{
							width: 92,
							height: 92,
							border: "3px solid #c28b4a",
							background: "#c28b4a22",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<PokeBall size={56} animate />
					</div>
					<div
						style={{
							fontFamily: ps2p,
							fontSize: 14,
							color: "#282828",
							letterSpacing: 1,
						}}
					>
						GOTCHA!
					</div>
					<div
						style={{
							fontFamily: ps2p,
							fontSize: 10,
							color: "#282828",
							textAlign: "center",
						}}
					>
						KOFFINS was caught!
					</div>
					<div
						style={{
							fontFamily: ps2p,
							fontSize: 8,
							color: "#586878",
							textAlign: "center",
							lineHeight: 1.7,
						}}
					>
						A hazy regular at the bar.
						<br />
						Smells faintly of stout and smoke.
					</div>
					<div
						style={{
							background: "#f0e0a0",
							border: "2px solid #282828",
							padding: "5px 8px",
							fontFamily: ps2p,
							fontSize: 8,
							color: "#282828",
							marginTop: 4,
						}}
					>
						ADDED TO YOUR TEAM!
					</div>
				</div>
			</PixelBox>
			<Continue variant="primary">CONTINUE CRAWL</Continue>
		</div>
	</Screen>
);

// B · PUBDEX registration card — diploma-style, with all stats
const CatchB = () => (
	<Screen bg="#d03838">
		<BattleHeader result="CAUGHT" />
		<div
			style={{
				flex: 1,
				padding: 12,
				display: "flex",
				flexDirection: "column",
				gap: 10,
			}}
		>
			<div
				style={{
					textAlign: "center",
					color: "#f8d030",
					fontFamily: ps2p,
					fontSize: 11,
					textShadow: "2px 2px 0 #a82828",
					padding: "4px 0",
				}}
			>
				PUBDEX +1
			</div>

			<div
				style={{
					background: "#f8f8f8",
					border: "3px solid #181010",
					padding: 10,
					position: "relative",
					boxShadow:
						"inset 2px 2px 0 #fff, inset -2px -2px 0 #a8b0b8, 2px 2px 0 0 rgba(0,0,0,0.5)",
				}}
			>
				{/* Header strip */}
				<div
					style={{
						background: "#4878d0",
						color: "#f8f8f8",
						padding: "4px 8px",
						fontFamily: ps2p,
						fontSize: 8,
						marginBottom: 8,
						display: "flex",
						justifyContent: "space-between",
						border: "2px solid #305098",
					}}
				>
					<span>PUBDEX ENTRY</span>
					<span>#0109</span>
				</div>

				<div style={{ display: "flex", gap: 10 }}>
					<div
						style={{
							width: 80,
							height: 80,
							background: "#d0e8f0",
							border: "2px solid #282828",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
							position: "relative",
							overflow: "hidden",
						}}
					>
						<img
							src="assets/sprites/koffing.png"
							style={{ width: 64, height: 64, imageRendering: "pixelated" }}
						/>
						<PokeBall
							size={14}
							style={{ position: "absolute", right: 3, top: 3 }}
						/>
					</div>
					<div
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							gap: 4,
						}}
					>
						<div style={{ fontFamily: ps2p, fontSize: 11, color: "#282828" }}>
							KOFFINS
						</div>
						<div style={{ display: "flex", gap: 4 }}>
							<TypeBadge type="beer" />
							<TypeBadge type="shot" />
						</div>
						<div
							style={{
								fontFamily: ps2p,
								fontSize: 7,
								color: "#586878",
								lineHeight: 1.5,
							}}
						>
							"THE GAS PUB-MON"
							<br />
							HT 2'00" · WT 2.1lb
						</div>
					</div>
				</div>

				<div
					style={{
						marginTop: 10,
						paddingTop: 8,
						borderTop: "2px dashed #a8b0b8",
					}}
				>
					<StatRow label="LEVEL" value="LV.14" />
					<StatRow label="HP" value="38 / 38" />
					<StatRow label="ABILITY" value="HOTBOX" />
					<StatRow label="CAUGHT AT" value="THE LEAKY TAP" />
					<StatRow label="DATE" value="MAY 8" />
				</div>

				{/* Stamp */}
				<div
					style={{
						position: "absolute",
						right: -6,
						bottom: 14,
						background: "#50b058",
						color: "#fff",
						fontFamily: ps2p,
						fontSize: 9,
						padding: "5px 8px",
						border: "2px solid #2c7a3d",
						transform: "rotate(-8deg)",
						boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)",
					}}
				>
					REGISTERED
				</div>
			</div>

			<Continue variant="yellow">CONTINUE CRAWL</Continue>
		</div>
	</Screen>
);

// C · Catch celebration — full sprite, confetti, nickname prompt
const CatchC = () => {
	const [naming, setNaming] = React.useState(false);
	const [nick, setNick] = React.useState("KOFFINS");
	return (
		<Screen bg="#262b44">
			<BattleHeader result="CAUGHT" />
			<div
				style={{
					flex: 1,
					padding: 14,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				{/* Hero sprite + sparkle burst */}
				<div
					style={{
						position: "relative",
						width: 200,
						height: 200,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginTop: 4,
					}}
				>
					<PixelBurst count={14} color="#f8d030" />
					<div
						style={{
							width: 120,
							height: 120,
							background: "#f8d030",
							border: "3px solid #181010",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							boxShadow:
								"inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 rgba(0,0,0,0.3)",
						}}
					>
						<img
							src="assets/sprites/koffing.png"
							style={{
								width: 96,
								height: 96,
								imageRendering: "pixelated",
								animation: "pixel-bounce 1s steps(2,end) infinite",
							}}
						/>
					</div>
					<PokeBall
						size={32}
						animate
						style={{ position: "absolute", left: 6, bottom: 6 }}
					/>
				</div>

				<div style={{ textAlign: "center" }}>
					<div
						style={{
							fontFamily: ps2p,
							fontSize: 16,
							color: "#f8d030",
							textShadow: "2px 2px 0 #181010",
							letterSpacing: 1,
						}}
					>
						GOTCHA!
					</div>
					<div
						style={{
							fontFamily: ps2p,
							fontSize: 9,
							color: "#f8f8f8",
							marginTop: 8,
							lineHeight: 1.6,
						}}
					>
						KOFFINS joined your round!
					</div>
				</div>

				{/* Nickname picker */}
				{!naming ? (
					<div
						style={{
							width: "100%",
							display: "flex",
							flexDirection: "column",
							gap: 8,
						}}
					>
						<PixelButton
							variant="default"
							onClick={() => setNaming(true)}
							style={{ width: "100%" }}
						>
							GIVE A NICKNAME?
						</PixelButton>
						<Continue variant="primary">CONTINUE CRAWL</Continue>
					</div>
				) : (
					<div
						style={{
							width: "100%",
							display: "flex",
							flexDirection: "column",
							gap: 8,
						}}
					>
						<PixelBox style={{ padding: 8 }}>
							<div
								style={{
									fontFamily: ps2p,
									fontSize: 8,
									color: "#586878",
									marginBottom: 6,
								}}
							>
								NEW NAME
							</div>
							<input
								value={nick}
								maxLength={10}
								onChange={(e) => setNick(e.target.value.toUpperCase())}
								style={{
									width: "100%",
									boxSizing: "border-box",
									fontFamily: ps2p,
									fontSize: 12,
									border: "2px solid #282828",
									padding: 6,
									background: "#fff",
									letterSpacing: 1,
									outline: "none",
								}}
							/>
						</PixelBox>
						<Continue variant="primary" onClick={() => setNaming(false)}>
							CONFIRM
						</Continue>
					</div>
				)}
			</div>
		</Screen>
	);
};

// ───────────────────────────────────────────────────────────────────
//                          V I C T O R Y
// ───────────────────────────────────────────────────────────────────

// A · Source-faithful: VICTORY! + +XP + experience text
const WinA = () => (
	<Screen>
		<BattleHeader result="VICTORY" />
		<div
			style={{
				flex: 1,
				padding: 14,
				display: "flex",
				flexDirection: "column",
				gap: 12,
				alignItems: "center",
				justifyContent: "flex-start",
			}}
		>
			<PixelBox style={{ width: "100%" }}>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 12,
						padding: "10px 4px",
					}}
				>
					<div
						style={{
							fontFamily: ps2p,
							fontSize: 16,
							color: "#4878d0",
							letterSpacing: 1,
							textShadow: "2px 2px 0 #d8e0e8",
						}}
					>
						VICTORY!
					</div>
					<div
						style={{
							fontFamily: ps2p,
							fontSize: 10,
							color: "#282828",
							textAlign: "center",
							lineHeight: 1.7,
						}}
					>
						You defeated
						<br />
						the wild GASTLY!
					</div>

					<div
						style={{
							border: "2px solid rgba(72,120,208,0.6)",
							padding: "6px 14px",
							fontFamily: ps2p,
							fontSize: 11,
							color: "#282828",
							background: "#eaf0fa",
						}}
					>
						+ 64 XP
					</div>

					<div
						style={{
							fontFamily: ps2p,
							fontSize: 8,
							color: "#586878",
							textAlign: "center",
							lineHeight: 1.7,
						}}
					>
						BULBASPRITZ gained experience!
					</div>

					<div style={{ width: "100%", marginTop: 4 }}>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontFamily: ps2p,
								fontSize: 7,
								color: "#586878",
								marginBottom: 3,
							}}
						>
							<span>LV.12</span>
							<span>620 / 800 EXP</span>
						</div>
						<XPBar from={0.32} to={0.78} />
					</div>
				</div>
			</PixelBox>
			<Continue variant="primary">CONTINUE CRAWL</Continue>
		</div>
	</Screen>
);

// B · Loot drop — coins + items + xp, arcade-style
const WinB = () => (
	<Screen bg="#262b44">
		<BattleHeader result="VICTORY" />
		<div
			style={{
				flex: 1,
				padding: 12,
				display: "flex",
				flexDirection: "column",
				gap: 10,
			}}
		>
			<div style={{ textAlign: "center", padding: "4px 0" }}>
				<div
					style={{
						fontFamily: ps2p,
						fontSize: 18,
						color: "#f8d030",
						textShadow: "3px 3px 0 #a82828",
						letterSpacing: 2,
					}}
				>
					YOU WON!
				</div>
				<div
					style={{
						fontFamily: ps2p,
						fontSize: 8,
						color: "#a8b0b8",
						marginTop: 6,
					}}
				>
					WILD GASTLY DEFEATED
				</div>
			</div>

			{/* Loot grid */}
			<div
				style={{
					background: "#f8f8f8",
					border: "3px solid #181010",
					padding: 8,
					boxShadow: "2px 2px 0 0 rgba(0,0,0,0.4)",
				}}
			>
				<div
					style={{
						fontFamily: ps2p,
						fontSize: 8,
						color: "#586878",
						marginBottom: 6,
					}}
				>
					SPOILS
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1fr 1fr 1fr",
						gap: 6,
					}}
				>
					{[
						{
							label: "+64 XP",
							bg: "#4878d0",
							icon: (
								<span style={{ fontFamily: ps2p, fontSize: 9, color: "#fff" }}>
									XP
								</span>
							),
						},
						{
							label: "+24 ¢",
							bg: "#f8d030",
							icon: (
								<div
									style={{
										width: 16,
										height: 16,
										borderRadius: "50%",
										background: "#fff8a0",
										border: "2px solid #a88820",
									}}
								/>
							),
						},
						{
							label: "POTION",
							bg: "#e43b44",
							icon: (
								<div
									style={{
										width: 14,
										height: 16,
										background: "#fff",
										border: "2px solid #181010",
									}}
								>
									<div style={{ height: 4, background: "#e43b44" }} />
								</div>
							),
						},
						{
							label: "BERRY",
							bg: "#63c74d",
							icon: (
								<div
									style={{
										width: 14,
										height: 14,
										borderRadius: "50%",
										background: "#e43b44",
										border: "2px solid #181010",
									}}
								/>
							),
						},
						{
							label: "COIN",
							bg: "#f8d030",
							icon: (
								<div
									style={{
										width: 14,
										height: 14,
										borderRadius: "50%",
										background: "#fff8a0",
										border: "2px solid #a88820",
									}}
								/>
							),
						},
						{
							label: "RARE",
							bg: "#a86dd9",
							icon: (
								<span
									style={{ fontFamily: ps2p, fontSize: 11, color: "#fff" }}
								></span>
							),
						},
					].map((it, i) => (
						<div
							key={i}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 4,
								padding: 6,
								background: it.bg,
								border: "2px solid #181010",
								boxShadow:
									"inset 2px 2px 0 rgba(255,255,255,0.25), inset -2px -2px 0 rgba(0,0,0,0.25)",
								animation: `loot-pop 0.5s steps(2,end) ${i * 80}ms both`,
							}}
						>
							<div
								style={{
									width: 24,
									height: 24,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{it.icon}
							</div>
							<div
								style={{
									fontFamily: ps2p,
									fontSize: 7,
									color: "#fff",
									textShadow: "1px 1px 0 #181010",
								}}
							>
								{it.label}
							</div>
						</div>
					))}
				</div>
			</div>

			<PixelBox>
				<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
					<img
						src="assets/sprites/bulbasaur.png"
						style={{ width: 48, height: 48, imageRendering: "pixelated" }}
					/>
					<div style={{ flex: 1 }}>
						<div style={{ fontFamily: ps2p, fontSize: 9, color: "#282828" }}>
							BULBASPRITZ
						</div>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontFamily: ps2p,
								fontSize: 7,
								color: "#586878",
								margin: "4px 0 3px",
							}}
						>
							<span>LV.12</span>
							<span>620 / 800</span>
						</div>
						<XPBar from={0.32} to={0.78} />
					</div>
				</div>
			</PixelBox>

			<Continue variant="yellow">CONTINUE CRAWL</Continue>
		</div>
	</Screen>
);

// C · LEVEL UP moment — stat gains, big banner
const WinC = () => (
	<Screen>
		<BattleHeader result="VICTORY" />
		<div
			style={{
				flex: 1,
				padding: 12,
				display: "flex",
				flexDirection: "column",
				gap: 10,
			}}
		>
			<div
				style={{
					background: "#f8d030",
					border: "3px solid #181010",
					padding: "8px 10px",
					textAlign: "center",
					boxShadow:
						"inset 2px 2px 0 rgba(255,255,255,0.5), inset -2px -2px 0 rgba(168,136,32,0.7), 3px 3px 0 0 rgba(0,0,0,0.3)",
					animation: "banner-flash 1.4s steps(3,end) infinite",
				}}
			>
				<div
					style={{
						fontFamily: ps2p,
						fontSize: 14,
						color: "#181010",
						letterSpacing: 1.5,
					}}
				>
					LEVEL UP!
				</div>
				<div
					style={{
						fontFamily: ps2p,
						fontSize: 8,
						color: "#5a4818",
						marginTop: 4,
					}}
				>
					BULBASPRITZ — LV.12 → LV.13
				</div>
			</div>

			<PixelBox>
				<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
					<div
						style={{
							width: 72,
							height: 72,
							background: "#d0e8f0",
							border: "2px solid #282828",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
							position: "relative",
						}}
					>
						<img
							src="assets/sprites/bulbasaur.png"
							style={{
								width: 64,
								height: 64,
								imageRendering: "pixelated",
								animation: "pixel-bounce 1s steps(2,end) infinite",
							}}
						/>
					</div>
					<div style={{ flex: 1 }}>
						<div
							style={{
								fontFamily: ps2p,
								fontSize: 8,
								color: "#586878",
								marginBottom: 4,
							}}
						>
							EXP TO NEXT
						</div>
						<XPBar from={0.0} to={0.18} />
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontFamily: ps2p,
								fontSize: 7,
								color: "#586878",
								marginTop: 4,
							}}
						>
							<span>+ 64 XP</span>
							<span>140 / 800</span>
						</div>
					</div>
				</div>
			</PixelBox>

			<PixelBox>
				<div
					style={{
						fontFamily: ps2p,
						fontSize: 8,
						color: "#586878",
						marginBottom: 6,
					}}
				>
					STAT GAINS
				</div>
				{[
					{ label: "HP", from: 38, to: 41 },
					{ label: "ATK", from: 14, to: 16 },
					{ label: "DEF", from: 12, to: 13 },
					{ label: "SPD", from: 11, to: 11 },
				].map((s, i) => (
					<div
						key={s.label}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							padding: "3px 0",
							borderBottom: i < 3 ? "1px dashed #a8b0b8" : "none",
							fontFamily: ps2p,
							fontSize: 8,
						}}
					>
						<span style={{ width: 36, color: "#586878" }}>{s.label}</span>
						<span style={{ color: "#282828" }}>{s.from}</span>
						<span style={{ color: "#a8b0b8" }}>→</span>
						<span style={{ color: s.to > s.from ? "#50b058" : "#586878" }}>
							{s.to}
						</span>
						{s.to > s.from && (
							<span style={{ marginLeft: "auto", color: "#50b058" }}>
								+{s.to - s.from}
							</span>
						)}
					</div>
				))}
			</PixelBox>

			<Continue variant="primary">CONTINUE CRAWL</Continue>
		</div>
	</Screen>
);

Object.assign(window, {
	RunA,
	RunB,
	RunC,
	CatchA,
	CatchB,
	CatchC,
	WinA,
	WinB,
	WinC,
});
