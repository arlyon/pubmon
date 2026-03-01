import concaveman from "concaveman";

export interface Point {
	x: number;
	y: number;
}

/**
 * Extracts non-transparent pixels from a sprite image and generates a convex hull hitbox
 * @param imageUrl - URL or path to the sprite image
 * @param targetWidth - Maximum width for processing (default 64)
 * @param targetHeight - Maximum height for processing (default 64)
 * @returns Array of vertices forming a convex polygon
 */
export async function getSpriteHitbox(
	imageUrl: string,
	targetWidth = 64,
	targetHeight = 64,
): Promise<Point[]> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";

		img.onload = () => {
			try {
				// Create a hidden canvas for processing
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");

				if (!ctx) {
					reject(new Error("Failed to get canvas context"));
					return;
				}

				// Calculate scale to fit within target dimensions while preserving aspect ratio
				const scale = Math.min(
					targetWidth / img.width,
					targetHeight / img.height,
					1, // Don't upscale
				);

				canvas.width = Math.floor(img.width * scale);
				canvas.height = Math.floor(img.height * scale);

				// CRITICAL: Disable image smoothing for pixel-perfect edge detection
				ctx.imageSmoothingEnabled = false;

				// Draw the scaled sprite
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

				// Extract pixel data
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const points: Point[] = [];

				// Collect all non-transparent edge pixels
				for (let y = 0; y < canvas.height; y++) {
					for (let x = 0; x < canvas.width; x++) {
						const idx = (y * canvas.width + x) * 4;
						const alpha = imageData.data[idx + 3];

						// If pixel is visible (alpha > threshold)
						if (alpha > 50) {
							// Check if it's an edge pixel (has at least one transparent neighbor)
							const isEdge = isEdgePixel(imageData, x, y, canvas.width, canvas.height);
							if (isEdge) {
								points.push({ x, y });
							}
						}
					}
				}

				if (points.length < 3) {
					// Fallback to a simple rectangle
					resolve([
						{ x: 0, y: 0 },
						{ x: canvas.width, y: 0 },
						{ x: canvas.width, y: canvas.height },
						{ x: 0, y: canvas.height },
					]);
					return;
				}

				// Generate convex hull using concaveman with Infinity for fully convex
				const hull = calculateConvexHull(points);

				// Simplify to max 16 vertices
				const simplified = simplifyPolygon(hull, 16);

				resolve(simplified);
			} catch (error) {
				reject(error);
			}
		};

		img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
		img.src = imageUrl;
	});
}

/**
 * Check if a pixel is on the edge of the sprite (has transparent neighbor)
 */
function isEdgePixel(
	imageData: ImageData,
	x: number,
	y: number,
	width: number,
	height: number,
): boolean {
	// Check 8 surrounding pixels
	const neighbors = [		[x - 1, y - 1],
		[x, y - 1],
		[x + 1, y - 1],
		[x - 1, y],
		[x + 1, y],
		[x - 1, y + 1],
		[x, y + 1],
		[x + 1, y + 1],
	];

	for (const [nx, ny] of neighbors) {
		if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
			return true; // Edge of canvas
		}

		const idx = (ny * width + nx) * 4;
		const alpha = imageData.data[idx + 3];

		if (alpha <= 50) {
			return true; // Transparent neighbor found
		}
	}

	return false;
}

/**
 * Calculate convex hull from a set of points using concaveman
 * @param points - Array of points to process
 * @returns Convex hull vertices
 */
export function calculateConvexHull(points: Point[]): Point[] {
	if (points.length < 3) return points;

	// Convert to the format concaveman expects: [x, y, x, y, ...]
	const coords: [number, number][] = [];
	for (const p of points) {
		coords.push([p.x, p.y]);
	}

	// Use Infinity concavity for fully convex hull
	const hull = concaveman(coords, Infinity, 1);

	// Convert back to Point[]
	const result: Point[] = [];
	for (let i = 0; i < hull.length; i += 2) {
	const [x, y] = hull[i];
		result.push({ x, y });
	}

	return result;
}

/**
 * Simplify a polygon to a maximum number of vertices using Douglas-Peucker-like reduction
 * @param points - Polygon vertices
 * @param maxVertices - Maximum number of vertices to keep
 * @returns Simplified polygon
 */
export function simplifyPolygon(points: Point[], maxVertices: number): Point[] {
	if (points.length <= maxVertices) return points;

	// Calculate perimeter distances
	const distances: number[] = [0];
	let totalDistance = 0;

	for (let i = 1; i < points.length; i++) {
		const dx = points[i].x - points[i - 1].x;
		const dy = points[i].y - points[i - 1].y;
		totalDistance += Math.sqrt(dx * dx + dy * dy);
		distances.push(totalDistance);
	}

	// Sample points evenly along the perimeter
	const step = totalDistance / maxVertices;
	const simplified: Point[] = [points[0]]; // Always keep first point

	let nextTargetDistance = step;
	for (let i = 1; i < points.length; i++) {
		if (distances[i] >= nextTargetDistance) {
			simplified.push(points[i]);
			nextTargetDistance += step;
		}
	}

	return simplified;
}

/**
 * Scale hitbox points from processing resolution to display resolution
 * @param points - Hitbox vertices at processing scale
 * @param fromWidth - Original processing width
 * @param fromHeight - Original processing height
 * @param toWidth - Target display width
 * @param toHeight - Target display height
 * @returns Scaled points
 */
export function scaleHitbox(
	points: Point[],
	fromWidth: number,
	fromHeight: number,
	toWidth: number,
	toHeight: number,
): Point[] {
	const scaleX = toWidth / fromWidth;
	const scaleY = toHeight / fromHeight;

	return points.map((p) => ({
		x: p.x * scaleX,
		y: p.y * scaleY,
	}));
}
