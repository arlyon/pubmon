"use client";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";

interface PixelScreenProps {
	children: React.ReactNode;
}

/**
 * PixelScreen renders children at exactly 320px logical width and applies
 * a CSS variable (--pixel-scale) for responsive scaling. Uses continuous
 * scaling optimized for HiDPI displays with a max 2x cap (640px).
 */
const PixelScreen: React.FC<PixelScreenProps> = ({ children }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState<number | null>(null);

	useLayoutEffect(() => {
		let timeoutId: NodeJS.Timeout;

		const updateScale = () => {
			if (!containerRef.current) return;
			const parent = containerRef.current.parentElement;
			if (!parent) return;

			// Calculate scale based on available width, capped at 640px (2x)
			const availableWidth = Math.min(parent.clientWidth, 1280);
			const newScale = Math.max(1, availableWidth / 320);

			console.log("SCALE", newScale);

			setScale(newScale * 2);
		};

		const debouncedUpdate = () => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(updateScale, 100);
		};

		// Run immediately on mount (before paint)
		updateScale();
		window.addEventListener("resize", debouncedUpdate);
		return () => {
			window.removeEventListener("resize", debouncedUpdate);
			clearTimeout(timeoutId);
		};
	}, []);

	// Don't render until we have calculated the initial scale
	if (scale === null) {
		return (
			<div ref={containerRef} className="pixel-perfect w-full flex justify-center" />
		);
	}

	return (
		<div
			ref={containerRef}
			className="pixel-perfect w-full flex justify-center"
		>
			<div
				style={{
					width: 320 * scale,
					maxWidth: 640,
					// @ts-expect-error CSS custom properties are valid
					"--pixel-scale": scale,
				}}
				className="pixel-perfect relative"
			>
				{children}
			</div>
		</div>
	);
};

export default PixelScreen;
