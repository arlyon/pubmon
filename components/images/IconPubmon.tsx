export function IconPubmon({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 10 10" className={`pixel-perfect size-gba-[12] ${className}`}>
			<title>Pubmon icon</title>
			<circle cx={5} cy={5} r={4.5} fill="none" stroke="currentColor" strokeWidth={1} />
			<rect x={0.5} y={4.5} width={9} height={1} fill="currentColor" />
			<circle cx={5} cy={5} r={1.5} fill="currentColor" />
		</svg>
	);
}
