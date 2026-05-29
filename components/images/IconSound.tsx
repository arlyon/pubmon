export function IconSound({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 12 12" className={`pixel-perfect size-gba-[12] ${className}`}>
			<title>Sound on</title>
			<rect x={0} y={4} width={3} height={4} fill="currentColor" />
			<polygon points="3,4 7,1 7,11 3,8" fill="currentColor" />
			<rect x={8} y={3} width={1.5} height={6} fill="currentColor" />
			<rect x={10} y={1} width={1.5} height={10} fill="currentColor" />
		</svg>
	);
}
