"use client";

import { useEffect, useState } from "react";
import { SKIP_TEASER, TOURNAMENT_START } from "@/lib/tournament";

export interface Countdown {
	/** Milliseconds until the target (clamped at 0). */
	remainingMs: number;
	/** True while the target is still in the future (and the teaser isn't skipped). */
	isBefore: boolean;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

/**
 * Live countdown to a target date. Ticks once per second.
 * Defaults to the tournament start. Respects the NEXT_PUBLIC_SKIP_TEASER dev flag.
 */
export function useCountdown(target: Date = TOURNAMENT_START): Countdown {
	const targetMs = target.getTime();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const remainingMs = Math.max(0, targetMs - now);
	const totalSec = Math.floor(remainingMs / 1000);

	return {
		remainingMs,
		isBefore: !SKIP_TEASER && now < targetMs,
		days: Math.floor(totalSec / 86400),
		hours: Math.floor((totalSec % 86400) / 3600),
		minutes: Math.floor((totalSec % 3600) / 60),
		seconds: totalSec % 60,
	};
}
