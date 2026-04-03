export interface PubGym {
	id: number;
	name: string;
	badge: boolean;
}

// Horizontal offsets for weaving path effect (in pixels)
export const weavingOffsets = [0, 40, 0, -40, 0, 40, 0, -40, 0, 40];
export const masterOffset = 0;

// Mock data - replace with actual gym data
export const createPubGymFromGyms = (
	gyms: any[],
	badges: Set<number>,
): PubGym[] => {
	return gyms.map((gym) => ({
		id: gym.id,
		name: gym.name,
		badge: badges.has(gym.id),
	}));
};
