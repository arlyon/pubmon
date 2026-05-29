/** Pokeball colored by type — used in starter selection row. */
export function TypePokeball({ color, size = 16 }: { color: string; size?: number }) {
	return (
		<svg viewBox="0 0 10 10" width={size} height={size} className="pixel-perfect">
			<circle cx={5} cy={5} r={4.5} fill={color} />
			<rect x={0.5} y={4.5} width={9} height={1} fill="rgb(var(--pixel-black))" />
			<circle cx={5} cy={5} r={4.5} fill="none" stroke="rgb(var(--pixel-black))" strokeWidth={0.5} />
			<rect x={0.5} y={5} width={9} height={4.5} rx={4.5} fill="rgb(var(--pixel-white))" />
			<circle cx={5} cy={5} r={1.2} fill="rgb(var(--pixel-white))" stroke="rgb(var(--pixel-black))" strokeWidth={0.4} />
			<circle cx={5} cy={5} r={0.6} fill="rgb(var(--pixel-black))" />
		</svg>
	);
}
