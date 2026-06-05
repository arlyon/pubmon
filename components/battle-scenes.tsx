// Battle scene backgrounds — 5 type scenes + 3 venue scenes
// Each scene renders parallax layers, foreground, and particle effects.

const Band = ({
	children,
	speed = "med",
	style = {},
}: {
	children: React.ReactNode;
	speed?: "slow" | "med" | "fast";
	style?: React.CSSProperties;
}) => (
	<div className={`parallax-band band-${speed}`} style={style}>
		<div>{children}</div>
		<div>{children}</div>
	</div>
);

const Px = ({
	x,
	y,
	w = 1,
	h = 1,
	fill,
}: {
	x: number;
	y: number;
	w?: number;
	h?: number;
	fill: string;
}) => (
	<rect
		x={x}
		y={y}
		width={w}
		height={h}
		fill={fill}
		shapeRendering="crispEdges"
	/>
);

// ─── TYPE SCENES ─────────────────────────────────────────────

const WaterScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#0a3a6e 0%, #1769a8 45%, #2898c8 100%)",
			}}
		/>
		<div
			style={{
				position: "absolute",
				inset: 0,
				opacity: 0.25,
				background:
					"repeating-linear-gradient(105deg, transparent 0 18px, rgba(255,255,255,0.3) 18px 22px, transparent 22px 60px)",
			}}
		/>
		<Band speed="slow" style={{ bottom: 0, height: "62%", top: "auto" }}>
			<svg
				viewBox="0 0 320 120"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
				style={{ display: "block" }}
			>
				{[20, 80, 140, 210, 280].map((x, i) => (
					<g key={i}>
						<Px x={x} y={40 + (i % 2) * 8} w={4} h={80} fill="#0e4d3a" />
						<Px x={x - 2} y={50} w={2} h={4} fill="#0e4d3a" />
						<Px x={x + 4} y={62} w={2} h={4} fill="#0e4d3a" />
					</g>
				))}
			</svg>
		</Band>
		<Band speed="med" style={{ bottom: 0, height: "56%", top: "auto" }}>
			<svg
				viewBox="0 0 320 120"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
				style={{ display: "block" }}
			>
				{[40, 120, 200, 260].map((x, i) => (
					<g key={i}>
						<Px x={x} y={20 + (i % 2) * 4} w={5} h={100} fill="#1a7a5e" />
						<Px x={x - 3} y={36} w={3} h={6} fill="#1a7a5e" />
						<Px x={x + 5} y={50} w={3} h={6} fill="#1a7a5e" />
					</g>
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "12%",
				background: "linear-gradient(#d8c078 0%, #b89858 100%)",
				borderTop: "2px solid #5a4828",
			}}
		/>
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{[
				{ x: 30, d: 0, s: 8 },
				{ x: 80, d: 1.2, s: 6 },
				{ x: 130, d: 0.6, s: 10 },
				{ x: 180, d: 2.0, s: 5 },
				{ x: 230, d: 0.3, s: 9 },
				{ x: 280, d: 1.6, s: 7 },
				{ x: 60, d: 2.4, s: 6 },
				{ x: 200, d: 3.1, s: 8 },
			].map((b, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: `${b.x / 3.2}%`,
						bottom: 0,
						width: b.s,
						height: b.s,
						borderRadius: "50%",
						background: "rgba(255,255,255,0.35)",
						border: "1px solid rgba(255,255,255,0.7)",
						animation: `bubble-rise ${4 + b.d}s linear ${b.d}s infinite`,
					}}
				/>
			))}
		</div>
	</>
);

const ShotScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#1a0808 0%, #3d1418 45%, #6e1c1c 80%, #d6432c 100%)",
			}}
		/>
		<Band speed="slow" style={{ top: "10%", height: "60%" }}>
			<svg
				viewBox="0 0 320 120"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{(
					[
						[10, 30, 4, 60],
						[60, 10, 3, 90],
						[120, 40, 5, 50],
						[180, 20, 3, 70],
						[240, 30, 4, 80],
						[290, 15, 3, 60],
					] as const
				).map(([x, y, w, h], i) => (
					<Px key={i} x={x} y={y} w={w} h={h} fill="#280808" />
				))}
			</svg>
		</Band>
		<Band speed="med" style={{ bottom: 0, height: "30%", top: "auto" }}>
			<svg
				viewBox="0 0 320 60"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				<rect x="0" y="40" width="320" height="20" fill="#e43b44" />
				<rect x="0" y="36" width="320" height="4" fill="#f8d030" />
				{(
					[
						[10, 32],
						[40, 30],
						[80, 34],
						[120, 30],
						[160, 32],
						[200, 28],
						[240, 34],
						[280, 30],
					] as const
				).map(([x, y], i) => (
					<Px key={i} x={x} y={y} w={6} h={3} fill="#ff8830" />
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"radial-gradient(ellipse at 50% 100%, rgba(255,180,80,0.45) 0%, transparent 60%)",
			}}
		/>
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{[
				{ x: 20, d: 0.0, c: "#f8d030" },
				{ x: 60, d: 1.4, c: "#ff8830" },
				{ x: 100, d: 0.7, c: "#ff5040" },
				{ x: 150, d: 2.1, c: "#f8d030" },
				{ x: 200, d: 0.4, c: "#ff8830" },
				{ x: 240, d: 1.8, c: "#ff5040" },
				{ x: 280, d: 0.9, c: "#f8d030" },
				{ x: 160, d: 3.0, c: "#ff8830" },
			].map((e, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: `${e.x / 3.2}%`,
						bottom: 12,
						width: 3,
						height: 3,
						background: e.c,
						boxShadow: `0 0 4px ${e.c}`,
						// @ts-expect-error CSS custom property
						"--drift": `${i % 2 ? -12 : 12}px`,
						animation: `ember-rise ${3 + e.d}s linear ${e.d}s infinite`,
					}}
				/>
			))}
		</div>
	</>
);

const WineScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#3b1840 0%, #6a2a64 45%, #b36488 80%, #f4a4c0 100%)",
			}}
		/>
		<Band speed="slow" style={{ top: 0, height: "55%" }}>
			<svg
				viewBox="0 0 320 100"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[40, 130, 220, 300].map((x, i) => (
					<g key={i}>
						<Px x={x} y={0} w={1} h={20} fill="#f8d030" />
						<Px x={x - 6} y={20} w={13} h={3} fill="#f8d030" />
						<Px x={x - 3} y={23} w={2} h={6} fill="#f8d030" />
						<Px x={x + 2} y={23} w={2} h={6} fill="#f8d030" />
						<Px x={x - 6} y={29} w={2} h={2} fill="#fff8d0" />
						<Px x={x + 5} y={29} w={2} h={2} fill="#fff8d0" />
					</g>
				))}
			</svg>
		</Band>
		<Band speed="med" style={{ bottom: 0, height: "45%", top: "auto" }}>
			<svg
				viewBox="0 0 320 90"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				<rect x="0" y="40" width="320" height="50" fill="#7a2848" />
				<rect x="0" y="40" width="320" height="3" fill="#a85068" />
				{[20, 60, 100, 140, 180, 220, 260, 300].map((x, i) => (
					<g key={i}>
						<rect x={x - 10} y={43} width={20} height={20} fill="#a85068" />
						<rect x={x - 10} y={43} width={20} height={2} fill="#c87890" />
					</g>
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"radial-gradient(ellipse at 50% 35%, rgba(248,200,220,0.35) 0%, transparent 60%)",
			}}
		/>
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{[20, 80, 140, 200, 260, 300].map((x, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: `${x / 3.2}%`,
						bottom: 0,
						width: 6,
						height: 5,
						animation: `heart-float ${5 + (i % 3)}s linear ${i * 0.7}s infinite`,
					}}
				>
					<svg viewBox="0 0 6 5" width="100%" height="100%">
						<Px x={1} y={1} w={1} h={1} fill="#f4a4c0" />
						<Px x={2} y={1} w={1} h={1} fill="#f8d8e8" />
						<Px x={3} y={1} w={1} h={1} fill="#f4a4c0" />
						<Px x={4} y={1} w={1} h={1} fill="#f4a4c0" />
						<Px x={1} y={2} w={4} h={1} fill="#f4a4c0" />
						<Px x={2} y={3} w={2} h={1} fill="#f4a4c0" />
						<Px x={2} y={4} w={2} h={1} fill="#f4a4c0" />
					</svg>
				</div>
			))}
		</div>
	</>
);

const BeerScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#1f1208 0%, #3a2614 50%, #5a3f1c 100%)",
			}}
		/>
		<Band speed="slow" style={{ top: 0, height: "30%" }}>
			<svg
				viewBox="0 0 320 50"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[10, 40, 80, 130, 170, 220, 260, 300].map((x, i) => (
					<g key={i}>
						<Px x={x} y={0} w={6} h={20 + (i % 3) * 4} fill="#3a2614" />
						<Px
							x={x + 2}
							y={20 + (i % 3) * 4}
							w={2}
							h={4}
							fill="#3a2614"
						/>
					</g>
				))}
			</svg>
		</Band>
		<Band
			speed="med"
			style={{ bottom: "10%", height: "30%", top: "auto" }}
		>
			<svg
				viewBox="0 0 320 60"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[20, 70, 140, 210, 270].map((x, i) => (
					<g key={i}>
						<rect x={x} y={20} width={36} height={36} fill="#7a4a1c" />
						<rect x={x} y={22} width={36} height={2} fill="#c28b4a" />
						<rect x={x} y={36} width={36} height={2} fill="#c28b4a" />
						<rect x={x} y={52} width={36} height={2} fill="#c28b4a" />
						<rect x={x + 14} y={28} width={8} height={6} fill="#1f1208" />
					</g>
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "12%",
				background:
					"repeating-linear-gradient(90deg, #2a1810 0 24px, #3a2614 24px 26px)",
				borderTop: "2px solid #1a0e08",
			}}
		/>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"radial-gradient(ellipse at 30% 40%, rgba(248,180,80,0.25) 0%, transparent 50%), radial-gradient(ellipse at 75% 50%, rgba(248,180,80,0.20) 0%, transparent 50%)",
			}}
		/>
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{[40, 90, 160, 220, 280, 120, 260].map((x, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: `${x / 3.2}%`,
						bottom: `${15 + (i % 4) * 10}%`,
						width: 2,
						height: 2,
						background: "rgba(248,200,120,0.7)",
						animation: `dust-float ${6 + (i % 3)}s linear ${i * 0.6}s infinite`,
					}}
				/>
			))}
		</div>
	</>
);

const CocktailScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#0c2a18 0%, #1c5236 45%, #4ea862 80%, #b8e088 100%)",
			}}
		/>
		<Band
			speed="slow"
			style={{ bottom: "8%", height: "70%", top: "auto" }}
		>
			<svg
				viewBox="0 0 320 140"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[20, 140, 260].map((x, i) => (
					<g key={i}>
						<Px x={x + 6} y={20} w={4} h={120} fill="#3a2614" />
						{(
							[
								[-12, -2],
								[12, -2],
								[-18, 8],
								[18, 8],
								[-8, -12],
								[8, -12],
							] as const
						).map(([dx, dy], j) => (
							<Px
								key={j}
								x={x + 8 + dx}
								y={20 + dy}
								w={14}
								h={3}
								fill="#1c5236"
							/>
						))}
					</g>
				))}
			</svg>
		</Band>
		<Band
			speed="med"
			style={{ bottom: "6%", height: "55%", top: "auto" }}
		>
			<svg
				viewBox="0 0 320 100"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[60, 200, 300].map((x, i) => (
					<g key={i}>
						<Px x={x} y={30} w={4} h={70} fill="#5a3a1a" />
						<Px x={x - 3} y={20} w={10} h={10} fill="#c28b4a" />
						<Px x={x - 2} y={14} w={8} h={6} fill="#f8d030" />
						<Px x={x - 1} y={10} w={6} h={4} fill="#ff8830" />
						<Px x={x} y={6} w={4} h={4} fill="#e43b44" />
					</g>
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "14%",
				background: "linear-gradient(#1c5236 0%, #3a7a4a 100%)",
				borderTop: "2px solid #0c2a18",
			}}
		/>
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{[20, 80, 150, 220, 280, 100, 260].map((x, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: `${x / 3.2}%`,
						top: 0,
						width: 6,
						height: 4,
						background: "#63c74d",
						boxShadow: "1px 1px 0 #2a6a30",
						animation: `leaf-fall ${7 + (i % 3)}s linear ${i * 0.9}s infinite`,
					}}
				/>
			))}
		</div>
	</>
);

// ─── VENUE SCENES ────────────────────────────────────────────

const BarScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#0e0a18 0%, #1f1830 60%, #2c2138 100%)",
			}}
		/>
		<Band speed="slow" style={{ top: "12%", height: "16%" }}>
			<svg
				viewBox="0 0 320 30"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				<rect x="0" y="22" width="320" height="3" fill="#5a3818" />
				{[10, 30, 50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290, 310].map(
					(x, i) => {
						const colors = [
							"#63c6e1",
							"#f4a4c0",
							"#c28b4a",
							"#e43b44",
							"#63c74d",
							"#f8d030",
							"#a86dd9",
						];
						const c = colors[i % colors.length];
						return (
							<g key={i}>
								<Px x={x} y={6} w={4} h={16} fill={c} />
								<Px x={x + 1} y={2} w={2} h={5} fill={c} />
								<Px
									x={x}
									y={9}
									w={4}
									h={2}
									fill="rgba(255,255,255,0.4)"
								/>
							</g>
						);
					},
				)}
			</svg>
		</Band>
		<Band speed="med" style={{ top: "30%", height: "16%" }}>
			<svg
				viewBox="0 0 320 30"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				<rect x="0" y="22" width="320" height="3" fill="#5a3818" />
				{[16, 36, 56, 76, 96, 116, 136, 156, 176, 196, 216, 236, 256, 276, 296].map(
					(x, i) => {
						const colors = [
							"#3a7aa8",
							"#a85068",
							"#7a4a1c",
							"#a82828",
							"#3a7a4a",
							"#a88820",
							"#6a3a8a",
						];
						const c = colors[i % colors.length];
						return (
							<g key={i}>
								<Px x={x} y={4} w={5} h={18} fill={c} />
								<Px x={x + 2} y={1} w={1} h={4} fill={c} />
							</g>
						);
					},
				)}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				height: "12%",
			}}
		>
			{[14, 36, 58, 80].map((x, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						left: `${x}%`,
						top: 0,
						width: 2,
						height: 30,
						background: "#282828",
					}}
				>
					<div
						style={{
							position: "absolute",
							left: -4,
							top: 24,
							width: 10,
							height: 14,
							background: "#f8d030",
							border: "1px solid #a88820",
							boxShadow: "0 0 12px #f8d03088",
						}}
					/>
				</div>
			))}
		</div>
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "30%",
				background: "linear-gradient(#3a2614 0%, #5a3818 100%)",
				borderTop: "3px solid #1f1208",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 4,
					height: 2,
					background: "#7a4a1c",
				}}
			/>
		</div>
	</>
);

const PubScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#3a1a18 0%, #6a2820 60%, #8a3828 100%)",
			}}
		/>
		<div
			style={{
				position: "absolute",
				inset: 0,
				opacity: 0.55,
				background:
					"repeating-linear-gradient(0deg, transparent 0 18px, #2a0c0a 18px 20px), repeating-linear-gradient(90deg, transparent 0 38px, #2a0c0a 38px 40px)",
			}}
		/>
		<Band speed="slow" style={{ top: 0, height: "30%" }}>
			<svg
				viewBox="0 0 320 50"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[40, 160, 260].map((x, i) => (
					<g key={i}>
						<Px x={x} y={0} w={1} h={14} fill="#282828" />
						<Px x={x - 12} y={14} w={25} h={3} fill="#3a2614" />
						<Px
							x={x - 10}
							y={17}
							w={21}
							h={14}
							fill={i % 2 ? "#1c5236" : "#a82828"}
						/>
						<Px x={x - 8} y={19} w={17} h={2} fill="#f8d030" />
						<Px x={x - 8} y={25} w={17} h={2} fill="#f8d030" />
					</g>
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				left: "12%",
				top: "14%",
				width: 36,
				height: 36,
			}}
		>
			<svg
				viewBox="0 0 12 12"
				width="100%"
				height="100%"
				shapeRendering="crispEdges"
			>
				<circle cx="6" cy="6" r="6" fill="#1f1208" />
				<circle cx="6" cy="6" r="5" fill="#f8d030" />
				<circle cx="6" cy="6" r="4" fill="#1f1208" />
				<circle cx="6" cy="6" r="3" fill="#f8d030" />
				<circle cx="6" cy="6" r="2" fill="#a82828" />
				<circle cx="6" cy="6" r="1" fill="#1c5236" />
			</svg>
		</div>
		<Band
			speed="med"
			style={{ bottom: "22%", height: "26%", top: "auto" }}
		>
			<svg
				viewBox="0 0 320 50"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[40, 90, 140, 190, 240, 290].map((x, i) => (
					<g key={i}>
						<Px x={x} y={10} w={4} h={30} fill="#a8a8b0" />
						<Px x={x - 3} y={6} w={10} h={6} fill="#c28b4a" />
						<Px x={x - 1} y={40} w={6} h={3} fill="#5a3818" />
						<Px
							x={x + 1}
							y={43}
							w={2}
							h={6}
							fill="rgba(248,200,120,0.6)"
						/>
					</g>
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "22%",
				background: "linear-gradient(#3a1c0a 0%, #5a2a10 100%)",
				borderTop: "3px solid #1a0a04",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 6,
					height: 2,
					background: "#7a4a1c",
				}}
			/>
		</div>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"radial-gradient(ellipse at 50% 60%, rgba(248,180,80,0.20) 0%, transparent 60%)",
			}}
		/>
	</>
);

const ClubScene = () => (
	<>
		<div
			style={{
				position: "absolute",
				inset: 0,
				background:
					"linear-gradient(#06010f 0%, #0e0420 50%, #1c0a3a 100%)",
			}}
		/>
		<div
			style={{
				position: "absolute",
				top: 10,
				left: 30,
				width: 200,
				height: 4,
				background: "linear-gradient(90deg, #e43b44, transparent)",
				transformOrigin: "0 50%",
				animation: "laser-sweep 3s ease-in-out infinite",
			}}
		/>
		<div
			style={{
				position: "absolute",
				top: 24,
				left: 10,
				width: 220,
				height: 3,
				background: "linear-gradient(90deg, #63c6e1, transparent)",
				transformOrigin: "0 50%",
				animation: "laser-sweep 4.5s ease-in-out infinite",
				animationDelay: "0.6s",
			}}
		/>
		<div
			style={{
				position: "absolute",
				top: 18,
				right: 20,
				width: 200,
				height: 3,
				background: "linear-gradient(270deg, #f4a4c0, transparent)",
				transformOrigin: "100% 50%",
				animation: "laser-sweep 3.7s ease-in-out infinite",
				animationDelay: "1.1s",
			}}
		/>
		<div
			style={{
				position: "absolute",
				top: 32,
				right: 0,
				width: 220,
				height: 4,
				background: "linear-gradient(270deg, #63c74d, transparent)",
				transformOrigin: "100% 50%",
				animation: "laser-sweep 5.2s ease-in-out infinite",
				animationDelay: "0.3s",
			}}
		/>
		<div
			style={{
				position: "absolute",
				top: 0,
				left: "50%",
				transform: "translateX(-50%)",
			}}
		>
			<div
				style={{
					width: 1,
					height: 14,
					background: "#666",
					margin: "0 auto",
				}}
			/>
			<div
				style={{
					width: 32,
					height: 32,
					position: "relative",
					background:
						"radial-gradient(circle at 35% 35%, #e0e0f0 0%, #8888a0 60%, #444460 100%)",
					border: "2px solid #1c0a3a",
					animation: "disco-spin 6s linear infinite",
					boxShadow: "0 0 16px rgba(255,255,255,0.4)",
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"repeating-linear-gradient(90deg, transparent 0 4px, rgba(0,0,0,0.3) 4px 5px), repeating-linear-gradient(0deg, transparent 0 4px, rgba(0,0,0,0.3) 4px 5px)",
					}}
				/>
			</div>
		</div>
		<Band
			speed="med"
			style={{ bottom: "16%", height: "30%", top: "auto" }}
		>
			<svg
				viewBox="0 0 320 60"
				preserveAspectRatio="none"
				width="100%"
				height="100%"
			>
				{[10, 40, 75, 115, 150, 185, 220, 255, 290].map((x, i) => (
					<g key={i}>
						<Px
							x={x}
							y={20 + (i % 2) * 4}
							w={8}
							h={8}
							fill="#06010f"
						/>
						<Px
							x={x - 2}
							y={28 + (i % 2) * 4}
							w={12}
							h={32}
							fill="#06010f"
						/>
						<Px
							x={x - 4}
							y={32 + (i % 2) * 4}
							w={3}
							h={14}
							fill="#06010f"
						/>
						<Px
							x={x + 9}
							y={32 + (i % 2) * 4}
							w={3}
							h={14}
							fill="#06010f"
						/>
					</g>
				))}
			</svg>
		</Band>
		<div
			style={{
				position: "absolute",
				top: "12%",
				right: 14,
				fontFamily: "'Press Start 2P', monospace",
				fontSize: 11,
				color: "#f4a4c0",
				textShadow: "0 0 6px #f4a4c0, 0 0 12px #e43b44",
				padding: "4px 6px",
				border: "2px solid #f4a4c0",
				boxShadow: "0 0 6px #f4a4c0",
				animation: "neon-flicker 3s steps(1,end) infinite",
			}}
		>
			BAR
		</div>
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				height: "16%",
				background:
					"repeating-conic-gradient(from 45deg, #e43b44 0 25%, #63c6e1 0 50%) 0 0 / 18px 18px",
				borderTop: "3px solid #06010f",
				opacity: 0.7,
			}}
		/>
	</>
);

// ─── SCENE SELECTION ─────────────────────────────────────────

const SCENE_MAP: Record<string, React.FC> = {
	water: WaterScene,
	shot: ShotScene,
	wine: WineScene,
	beer: BeerScene,
	cocktail: CocktailScene,
	food: ClubScene,
};

const VENUE_SCENES: React.FC[] = [BarScene, PubScene, ClubScene];

/** Stable string hash (djb2) for deterministic scene selection. */
function hashSeed(seed: string): number {
	let h = 5381;
	for (let i = 0; i < seed.length; i++) {
		h = (h * 33) ^ seed.charCodeAt(i);
	}
	return h >>> 0;
}

export function pickBattleScene(
	playerType: string,
	wildType: string,
	seed?: string | number,
): React.FC {
	const candidates: React.FC[] = [];

	const playerScene = SCENE_MAP[playerType];
	if (playerScene) candidates.push(playerScene);

	const wildScene = SCENE_MAP[wildType];
	if (wildScene && wildScene !== playerScene) candidates.push(wildScene);

	candidates.push(...VENUE_SCENES);

	if (candidates.length === 0) return BarScene;

	// Deterministic when a seed is given (e.g. battleId) so both clients in a
	// P2P battle render the same arena and it stays stable across re-renders.
	const index =
		seed !== undefined
			? hashSeed(String(seed)) % candidates.length
			: Math.floor(Math.random() * candidates.length);

	return candidates[index];
}
