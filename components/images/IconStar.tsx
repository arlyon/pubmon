export function IconStar({
	fill,
	stroke = "#282828",
	size = 32,
}: {
	fill: string;
	stroke?: string;
	size?: number;
}) {
	return (
		<svg viewBox="0 0 12 12" width={size} height={size} shapeRendering="crispEdges">
			<polygon
				points="6,1 7.2,4.6 11,4.8 8,7.2 9,11 6,9.2 3,11 4,7.2 1,4.8 4.8,4.6"
				fill={fill}
				stroke={stroke}
				strokeWidth="0.8"
			/>
		</svg>
	);
}
