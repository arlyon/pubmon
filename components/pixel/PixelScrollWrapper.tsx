"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface PixelScrollWrapperProps {
	children: React.ReactNode;
	/** Disable the pixel-snapping effect (defaults to false) */
	disabled?: boolean;
	/** CSS class for the wrapper */
	className?: string;
}

/**
 * PixelScrollWrapper provides experimental pixel-perfect scrolling that
 * visually snaps scroll positions to the nearest --pixel-scale increment.
 * Native scroll momentum is preserved for a smooth UX.
 *
 * Implementation:
 * - Uses a hidden native scroll container for actual scrolling
 * - Applies visual rounding via transform on the content wrapper
 * - Can be easily disabled if the retro snapping ruins the feel
 */
const PixelScrollWrapper: React.FC<PixelScrollWrapperProps> = ({
	children,
	disabled = false,
	className = "",
}) => {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [pixelScale, setPixelScale] = useState(1);

	useEffect(() => {
		// Read the --pixel-scale CSS variable from the DOM
		const updatePixelScale = () => {
			if (!contentRef.current) return;
			const computed = getComputedStyle(contentRef.current);
			const scale = computed.getPropertyValue("--pixel-scale");
			const numScale = Number.parseFloat(scale) || 1;
			setPixelScale(numScale);
		};

		updatePixelScale();

		// Watch for --pixel-scale changes (e.g., on resize)
		const observer = new MutationObserver(updatePixelScale);
		if (contentRef.current) {
			observer.observe(contentRef.current, {
				attributes: true,
				attributeFilter: ["style"],
			});
		}

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (disabled) return;

		const scrollContainer = scrollContainerRef.current;
		const content = contentRef.current;
		if (!scrollContainer || !content) return;

		const handleScroll = () => {
			const scrollTop = scrollContainer.scrollTop;

			// Round scroll position to nearest pixel-scale increment
			const roundedScroll = Math.round(scrollTop / pixelScale) * pixelScale;

			// Apply visual offset via transform (doesn't affect actual scroll position)
			const offset = scrollTop - roundedScroll;
			content.style.transform = `translateY(${-offset}px)`;
		};

		scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

		return () => scrollContainer.removeEventListener("scroll", handleScroll);
	}, [disabled, pixelScale]);

	if (disabled) {
		// When disabled, just render children directly without scroll wrapping
		return <div className={className}>{children}</div>;
	}

	return (
		<div
			ref={scrollContainerRef}
			className={`relative overflow-y-auto`}
			style={{
				// Ensure native scrolling works
				overflowY: "auto",
				WebkitOverflowScrolling: "touch",
			}}
		>
			<div ref={contentRef} className={className}>
				{children}
			</div>
		</div>
	);
};

export default PixelScrollWrapper;
