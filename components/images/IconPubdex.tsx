export function IconPubdex({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 12 12" className={`pixel-perfect size-gba-[12] ${className}`}>
			<title>Pubdex icon</title>
			<rect x={0} y={0} width={12} height={12} rx={1} fill="currentColor" />
			<rect x={1} y={1} width={10} height={10} rx={1} fill="rgb(var(--pixel-white))" />
			<rect x={2} y={2} width={8} height={5} fill="currentColor" opacity={0.3} />
			<rect x={3} y={8} width={6} height={1} fill="currentColor" opacity={0.3} />
		</svg>
	);
}
