/**
 * Trainer sprite utilities
 * Works dynamically like pubmon sprites - no hardcoding needed
 */

export type Gender = "boy" | "girl" | "mystery";

/**
 * Names that have dedicated trainer artwork in /public/sprites/pubtrainers.
 * When a player's name matches one of these, we use their custom portrait
 * instead of the generic gender fallback.
 */
export const CUSTOM_TRAINER_SPRITES = new Set([
	"ale",
	"alex",
	"ali",
	"amani",
	"ashley",
	"calum",
	"chloe",
	"chloefay",
	"emilie",
	"emily",
	"emma",
	"gus",
	"jack",
	"jackson",
	"kat",
	"kitty",
	"luke",
	"nadia",
	"oli",
	"ornella",
	"quitterie",
	"sean",
	"theo",
	"tom",
]);

/**
 * Get the trainer sprite filename for a given name
 * Converts name to lowercase for the sprite file
 */
export function getTrainerSprite(name: string, gender: Gender): string {
	// Use lowercase name as sprite identifier
	return name.trim().toLowerCase();
}

/**
 * Get the sprite path for a trainer
 * Tries custom trainer sprite first, falls back to default red/lyra
 */
export function getTrainerSpritePath(spriteId: string): string {
	return `/sprites/pubtrainers/${spriteId}.png`;
}

/**
 * Whether a typed name has a dedicated custom trainer portrait.
 */
export function hasCustomTrainerSprite(name: string): boolean {
	return CUSTOM_TRAINER_SPRITES.has(name.trim().toLowerCase());
}

/**
 * Get the fallback sprite based on gender
 * Falls back to red (boy) or lyra (girl). Mystery has no portrait of its
 * own, so it borrows red and is rendered as a silhouette by the UI.
 */
export function getFallbackTrainerSprite(gender: Gender): string {
	return gender === "girl" ? "lyra" : "red";
}

/**
 * Resolve the best trainer sprite for a name: a custom portrait if one exists,
 * otherwise the gender fallback.
 */
export function resolveTrainerSprite(name: string, gender: Gender): string {
	const id = name.trim().toLowerCase();
	return CUSTOM_TRAINER_SPRITES.has(id) ? id : getFallbackTrainerSprite(gender);
}
