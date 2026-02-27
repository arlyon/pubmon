"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Howl } from "howler";

type TrackId =
	| "battle"
	| "world-of-pokemon"
	| "pokemon-lab"
	| "title-screen"
	| "route-1"
	| "victory"
	| "caught"
	| "pokemon-obtained"
	| "evolution";

interface AudioContextType {
	playBGM: (trackId: TrackId) => void;
	stopBGM: () => void;
	playSFX: (trackId: TrackId) => void;
	playCry: (cryNumber: number) => void;
	preloadTrack: (trackId: TrackId) => void;
	preloadCry: (cryNumber: number) => void;
	setVolume: (volume: number) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

const AUDIO_PATHS: Record<TrackId, string> = {
	battle: "/audio/battle.mp3",
	"world-of-pokemon": "/audio/world-of-pokemon.mp3",
	"pokemon-lab": "/audio/pokemon-lab.mp3",
	"title-screen": "/audio/title-screen.mp3",
	"route-1": "/audio/route-1.mp3",
	victory: "/audio/victory.mp3",
	caught: "/audio/caught.mp3",
	"pokemon-obtained": "/audio/pokemon-obtained.mp3",
	evolution: "/audio/evolution.mp3",
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
	const bgmRef = useRef<Howl | null>(null);
	const currentTrackRef = useRef<TrackId | null>(null);
	const [volume, setVolumeState] = useState(0.5);

	// Store pre-loaded tracks and cries
	const preloadedTracksRef = useRef<Map<TrackId, Howl>>(new Map());
	const preloadedCriesRef = useRef<Map<number, Howl>>(new Map());

	const playBGM = (trackId: TrackId) => {
		// If same track is already playing, do nothing
		if (currentTrackRef.current === trackId && bgmRef.current?.playing()) {
			return;
		}

		// Check if there's currently music playing
		const hasCurrentMusic = bgmRef.current !== null;

		// Handle previous BGM
		if (bgmRef.current) {
			const oldSound = bgmRef.current;

			// Battle track should cut immediately, others fade out
			if (trackId === "battle") {
				oldSound.stop();
				oldSound.unload();
			} else {
				// Fade out over 1 second
				oldSound.fade(oldSound.volume(), 0, 1000);
				setTimeout(() => {
					oldSound.stop();
					oldSound.unload();
				}, 1000);
			}
		}

		// Create and play new track
		// If no music is currently playing OR it's a battle track, start at full volume
		// Otherwise, start at 0 for fade in
		const shouldFadeIn = hasCurrentMusic && trackId !== "battle";
		const sound = new Howl({
			src: [AUDIO_PATHS[trackId]],
			loop: true,
			volume: shouldFadeIn ? 0 : volume,
		});

		sound.play();

		// Fade in new track only if transitioning from existing music (except battle)
		if (shouldFadeIn) {
			sound.fade(0, volume, 1000);
		}

		bgmRef.current = sound;
		currentTrackRef.current = trackId;
	};

	const stopBGM = () => {
		if (bgmRef.current) {
			bgmRef.current.stop();
			bgmRef.current.unload();
			bgmRef.current = null;
			currentTrackRef.current = null;
		}
	};

	const playSFX = (trackId: TrackId) => {
		const sound = new Howl({
			src: [AUDIO_PATHS[trackId]],
			loop: false,
			volume: volume,
		});

		sound.play();
	};

	const playCry = (cryNumber: number) => {
		const paddedNumber = cryNumber.toString().padStart(3, "0");
		const sound = new Howl({
			src: [`/audio/cries/${paddedNumber}.wav`],
			loop: false,
			volume: volume,
		});

		sound.play();
	};

	const setVolume = (newVolume: number) => {
		setVolumeState(newVolume);
		if (bgmRef.current) {
			bgmRef.current.volume(newVolume);
		}
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (bgmRef.current) {
				bgmRef.current.stop();
				bgmRef.current.unload();
			}
		};
	}, []);

	return (
		<AudioContext.Provider value={{ playBGM, stopBGM, playSFX, playCry, setVolume }}>
			{children}
		</AudioContext.Provider>
	);
}

export function useAudio() {
	const context = useContext(AudioContext);
	if (!context) {
		throw new Error("useAudio must be used within AudioProvider");
	}
	return context;
}
