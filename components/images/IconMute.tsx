export function IconMute({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 12 12" className={`pixel-perfect size-gba-[12] ${className}`}>
			<title>Muted</title>
			<rect x={0} y={4} width={3} height={4} fill="currentColor" />
			<polygon points="3,4 7,1 7,11 3,8" fill="currentColor" />
			<rect x={9} y={2} width={1.5} height={1.5} fill="currentColor" />
			<rect x={10.5} y={3.5} width={1.5} height={1.5} fill="currentColor" />
			<rect x={9} y={5} width={1.5} height={1.5} fill="currentColor" />
			<rect x={10.5} y={6.5} width={1.5} height={1.5} fill="currentColor" />
			<rect x={9} y={8} width={1.5} height={1.5} fill="currentColor" />
		</svg>
	);
}
