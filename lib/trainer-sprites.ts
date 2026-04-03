/**
 * Trainer sprite utilities
 * Works dynamically like pubmon sprites - no hardcoding needed
 */

/**
 * Get the trainer sprite filename for a given name
 * Converts name to lowercase for the sprite file
 */
export function getTrainerSprite(name: string, gender: "boy" | "girl"): string {
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
 * Get the fallback sprite based on gender
 * Falls back to red (boy) or lyra (girl)
 */
export function getFallbackTrainerSprite(gender: "boy" | "girl"): string {
	return gender === "boy" ? "red" : "lyra";
}
