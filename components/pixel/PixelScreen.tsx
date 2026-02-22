"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface PixelScreenProps {
	children: React.ReactNode;
}

/**
 * PixelScreen renders children at exactly 320px wide and scales up
 * using nearest-neighbor to fill available width. Content can overflow vertically.
 */
const PixelScreen: React.FC<PixelScreenProps> = ({ children }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const updateScale = () => {
			if (!containerRef.current) return;
			const parent = containerRef.current.parentElement;
			if (!parent) return;
			const availableWidth = parent.clientWidth;
			// Scale to nearest integer multiple for pixel-perfect rendering
			const rawScale = availableWidth / 320;
			// Also clamp by height if we want to ensure it fits in screen, but width is primary here
			const intScale = Math.max(1, Math.floor(rawScale));
			setScale(intScale);
		};

		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, []);

	return (
		<div
			ref={containerRef}
			className="pixel-perfect w-full flex justify-center"
		>
			<div
				style={{
					width: 320,
					transformOrigin: "top center",
					// transform: `scale(${scale})`,
					fontFamily: "var(--font-pixel)",
				}}
				className="pixel-perfect relative"
			>
				{children}
			</div>
		</div>
	);
};

export default PixelScreen;
