"use client";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TransitionConfig {
	totalFrames: number;
	renderFrame: (
		ctx: CanvasRenderingContext2D,
		frame: number,
		width: number,
		height: number,
	) => void;
	frameDelay?: number;
}

export const barBlindsTransition = (barCount: number = 8): TransitionConfig => {
	const totalFrames = 20;
	return {
		totalFrames,
		frameDelay: 30,
		renderFrame(ctx, frame, width, height) {
			const barHeight = Math.ceil(height / barCount);
			const progress = frame / totalFrames;

			ctx.fillStyle = "#000000";

			for (let i = 0; i < barCount; i++) {
				const y = i * barHeight;
				const barWidth = Math.round(progress * width);
				if (i % 2 === 0) {
					ctx.fillRect(0, y, barWidth, barHeight);
				} else {
					ctx.fillRect(width - barWidth, y, barWidth, barHeight);
				}
			}
		},
	};
};

export const circleWipeTransition = (): TransitionConfig => {
	const totalFrames = 16;
	return {
		totalFrames,
		frameDelay: 40,
		renderFrame(ctx, frame, width, height) {
			const progress = frame / totalFrames;
			const maxRadius = Math.sqrt(width * width + height * height) / 2;
			const radius = maxRadius * (1 - progress);

			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, width, height);

			ctx.globalCompositeOperation = "destination-out";
			const cx = Math.floor(width / 2);
			const cy = Math.floor(height / 2);
			for (let py = 0; py < height; py += 2) {
				for (let px = 0; px < width; px += 2) {
					const dx = px - cx;
					const dy = py - cy;
					if (dx * dx + dy * dy < radius * radius) {
						ctx.fillRect(px, py, 2, 2);
					}
				}
			}
			ctx.globalCompositeOperation = "source-over";
		},
	};
};

export const verticalBlindsTransition = (
	sliceCount: number = 10,
): TransitionConfig => {
	const totalFrames = 18;
	return {
		totalFrames,
		frameDelay: 30,
		renderFrame(ctx, frame, width, height) {
			const sliceWidth = Math.ceil(width / sliceCount);
			const progress = frame / totalFrames;

			ctx.fillStyle = "#000000";

			for (let i = 0; i < sliceCount; i++) {
				const x = i * sliceWidth;
				const barHeight = Math.round(progress * height);
				if (i % 2 === 0) {
					ctx.fillRect(x, 0, sliceWidth, barHeight);
				} else {
					ctx.fillRect(x, height - barHeight, sliceWidth, barHeight);
				}
			}
		},
	};
};

interface PixelTransitionProps {
	transition: TransitionConfig;
	active: boolean;
	onMidpoint?: () => void;
	onComplete?: () => void;
	width?: number;
	height?: number;
	holdDuration?: number;
	/**
	 * When provided, the transition stays fully-covered after `onMidpoint`
	 * until this becomes `true` (the reveal is gated on async readiness, e.g.
	 * battle data). A `maxHold` fallback still reveals so it can never wedge.
	 */
	release?: boolean;
	/** Safety cap (ms) on a gated hold so the reveal always eventually runs. */
	maxHold?: number;
}

type Phase = "idle" | "in" | "hold" | "out" | "done";

const PixelTransition: React.FC<PixelTransitionProps> = ({
	transition,
	active,
	onMidpoint,
	onComplete,
	width = 320,
	height = 240,
	holdDuration = 400,
	release,
	maxHold = 6000,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [phase, setPhase] = useState<Phase>("idle");
	const frameRef = useRef(0);
	const timerRef = useRef<number | null>(null);
	const isAnimatingRef = useRef(false);
	const outStartedRef = useRef(false);

	const onMidpointRef = useRef(onMidpoint);
	const onCompleteRef = useRef(onComplete);
	const transitionRef = useRef(transition);
	const widthRef = useRef(width);
	const heightRef = useRef(height);
	const holdDurationRef = useRef(holdDuration);
	const releaseRef = useRef(release);
	const maxHoldRef = useRef(maxHold);

	useEffect(() => {
		onMidpointRef.current = onMidpoint;
		onCompleteRef.current = onComplete;
		transitionRef.current = transition;
		widthRef.current = width;
		heightRef.current = height;
		holdDurationRef.current = holdDuration;
		releaseRef.current = release;
		maxHoldRef.current = maxHold;
	}, [onMidpoint, onComplete, transition, width, height, holdDuration, release, maxHold]);

	const clearTimers = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const renderAt = useCallback((frame: number) => {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, widthRef.current, heightRef.current);
		transitionRef.current.renderFrame(
			ctx,
			frame,
			widthRef.current,
			heightRef.current,
		);
	}, []);

	// Reveal (fully-covered -> clear). Guarded so it runs once per cycle, no
	// matter whether the timed hold or the `release` gate triggers it.
	const startOut = useCallback(() => {
		if (outStartedRef.current) return;
		outStartedRef.current = true;
		clearTimers();
		frameRef.current = 0;
		setPhase("out");
		const stepOut = () => {
			frameRef.current++;
			const total = transitionRef.current.totalFrames;
			renderAt(total - frameRef.current);
			if (frameRef.current >= total) {
				setPhase("done");
				isAnimatingRef.current = false;
				onCompleteRef.current?.();
			} else {
				timerRef.current = window.setTimeout(
					stepOut,
					transitionRef.current.frameDelay ?? 33,
				);
			}
		};
		stepOut();
	}, [clearTimers, renderAt]);

	useEffect(() => {
		if (active && !isAnimatingRef.current) {
			isAnimatingRef.current = true;
			outStartedRef.current = false;
			frameRef.current = 0;
			setPhase("in");

			const stepIn = () => {
				frameRef.current++;
				renderAt(frameRef.current);

				if (frameRef.current >= transitionRef.current.totalFrames) {
					setPhase("hold");
					onMidpointRef.current?.();
					// Reveal on a timer, unless gated on `release` (then hold up to
					// maxHold as a safety net while the release effect waits).
					timerRef.current = window.setTimeout(
						startOut,
						releaseRef.current === undefined
							? holdDurationRef.current
							: maxHoldRef.current,
					);
				} else {
					timerRef.current = window.setTimeout(
						stepIn,
						transitionRef.current.frameDelay ?? 33,
					);
				}
			};

			stepIn();
		}

		// Aborting (active -> false) hard-resets the instance even mid-animation,
		// so a gated hold can never get stuck and wedge future transitions.
		if (!active) {
			clearTimers();
			isAnimatingRef.current = false;
			outStartedRef.current = false;
			setPhase("idle");
			const ctx = canvasRef.current?.getContext("2d");
			if (ctx) ctx.clearRect(0, 0, widthRef.current, heightRef.current);
		}
	}, [active, renderAt, startOut, clearTimers]);

	// Reveal as soon as the caller signals readiness (while covered).
	useEffect(() => {
		if (phase === "hold" && release === true) startOut();
	}, [phase, release, startOut]);

	const isVisible = phase !== "idle" && phase !== "done";

	return (
		<canvas
			ref={canvasRef}
			width={width}
			height={height}
			className="pixel-perfect"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width,
				height,
				pointerEvents: isVisible ? "all" : "none",
				zIndex: 100,
				opacity: isVisible ? 1 : 0,
			}}
		/>
	);
};

export default PixelTransition;
