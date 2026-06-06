// When the Grand Pub League tournament begins.
// Stored in Europe/London time (BST = +01:00). Edit this to move the start.
// Optionally overridable at build time via NEXT_PUBLIC_TOURNAMENT_START.
export const TOURNAMENT_START = new Date(
	process.env.NEXT_PUBLIC_TOURNAMENT_START ?? "2026-06-06T12:00:00+01:00",
);

// Local-dev escape hatch: set NEXT_PUBLIC_SKIP_TEASER=true to skip the
// pre-tournament countdown and drop straight into the game.
export const SKIP_TEASER = process.env.NEXT_PUBLIC_SKIP_TEASER === "true";
