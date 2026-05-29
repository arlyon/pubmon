export function IconSettings({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 12 12" className={`pixel-perfect size-gba-[12] ${className}`}>
			<title>Settings icon</title>
			<circle cx={6} cy={6} r={2} fill="currentColor" />
			<rect x={5} y={0} width={2} height={2} fill="currentColor" />
			<rect x={5} y={10} width={2} height={2} fill="currentColor" />
			<rect x={0} y={5} width={2} height={2} fill="currentColor" />
			<rect x={10} y={5} width={2} height={2} fill="currentColor" />
			<rect x={1.5} y={1.5} width={1.5} height={1.5} fill="currentColor" />
			<rect x={9} y={1.5} width={1.5} height={1.5} fill="currentColor" />
			<rect x={1.5} y={9} width={1.5} height={1.5} fill="currentColor" />
			<rect x={9} y={9} width={1.5} height={1.5} fill="currentColor" />
		</svg>
	);
}
