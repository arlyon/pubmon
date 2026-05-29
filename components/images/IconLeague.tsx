export function IconLeague({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 12 12" className={`pixel-perfect size-gba-[12] ${className}`}>
			<title>League icon</title>
			<polygon
				points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9 3,11 3.5,7.5 1,5 4.5,4.5"
				fill="currentColor"
			/>
		</svg>
	);
}
