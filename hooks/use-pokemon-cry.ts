import { useCallback, useMemo } from "react";
import { useAudio } from "@/components/audio-manager";
import type { PubMon } from "@/lib/pokemon-data";

/**
 * Hook to manage pokemon cry audio playback using the audio manager
 * @param pokemon - Array of PubMon to create cry mappings from
 * @returns Object with playPokemonCry function
 */
export function usePokemonCry(pokemon: PubMon[]) {
	const { playCry } = useAudio();

	// Create a map from pokemon ID to cry number from the actual pokemon data
	const pokemonCryMap = useMemo(() => {
		const map = new Map<number, number>();
		pokemon.forEach((mon) => {
			map.set(mon.id, mon.cry);
		});
		return map;
	}, [pokemon]);

	const playPokemonCry = useCallback((pokemonId: number) => {
		const cryNumber = pokemonCryMap.get(pokemonId);
		if (!cryNumber) return;

		playCry(cryNumber);
	}, [pokemonCryMap]);

	return { playPokemonCry };
}
