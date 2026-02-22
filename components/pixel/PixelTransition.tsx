"use client"
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
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [phase, setPhase] = useState<Phase>("idle");
    const frameRef = useRef(0);
    const timerRef = useRef<number | null>(null);
    const isAnimatingRef = useRef(false);

    const onMidpointRef = useRef(onMidpoint);
    const onCompleteRef = useRef(onComplete);
    const transitionRef = useRef(transition);
    const widthRef = useRef(width);
    const heightRef = useRef(height);
    const holdDurationRef = useRef(holdDuration);

    useEffect(() => {
        onMidpointRef.current = onMidpoint;
        onCompleteRef.current = onComplete;
        transitionRef.current = transition;
        widthRef.current = width;
        heightRef.current = height;
        holdDurationRef.current = holdDuration;
    }, [onMidpoint, onComplete, transition, width, height, holdDuration]);

    const clearTimers = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (active && !isAnimatingRef.current) {
            isAnimatingRef.current = true;
            frameRef.current = 0;
            setPhase("in");

            const stepIn = () => {
                frameRef.current++;

                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        const w = widthRef.current;
                        const h = heightRef.current;
                        const trans = transitionRef.current;
                        ctx.clearRect(0, 0, w, h);
                        const actualFrame = frameRef.current;
                        trans.renderFrame(ctx, actualFrame, w, h);
                    }
                }

                if (frameRef.current >= transitionRef.current.totalFrames) {
                    setPhase("hold");
                    onMidpointRef.current?.();

                    timerRef.current = window.setTimeout(() => {
                        frameRef.current = 0;
                        setPhase("out");

                        const stepOut = () => {
                            frameRef.current++;

                            const canvas = canvasRef.current;
                            if (canvas) {
                                const ctx = canvas.getContext("2d");
                                if (ctx) {
                                    const w = widthRef.current;
                                    const h = heightRef.current;
                                    const trans = transitionRef.current;
                                    ctx.clearRect(0, 0, w, h);
                                    const actualFrame = trans.totalFrames - frameRef.current;
                                    trans.renderFrame(ctx, actualFrame, w, h);
                                }
                            }

                            if (frameRef.current >= transitionRef.current.totalFrames) {
                                setPhase("done");
                                isAnimatingRef.current = false;
                                onCompleteRef.current?.();
                            } else {
                                timerRef.current = window.setTimeout(stepOut, transitionRef.current.frameDelay ?? 33);
                            }
                        };

                        stepOut();
                    }, holdDurationRef.current);
                } else {
                    timerRef.current = window.setTimeout(stepIn, transitionRef.current.frameDelay ?? 33);
                }
            };

            stepIn();
        }

        if (!active && !isAnimatingRef.current) {
            setPhase("idle");
            const ctx = canvasRef.current?.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, widthRef.current, heightRef.current);
        }
    }, [active]);

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
