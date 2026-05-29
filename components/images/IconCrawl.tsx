export function IconCrawl({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 8 8" className={`pixel-perfect size-gba-[12] ${className}`}>
			<title>Crawl icon</title>
			<rect x={2} y={0} width={4} height={1} fill="currentColor" />
			<rect x={1} y={1} width={6} height={5} fill="currentColor" />
			<rect x={3} y={6} width={2} height={2} fill="currentColor" />
		</svg>
	);
}
