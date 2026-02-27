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

	const playBGM = (trackId: TrackId) => {
		// If same track is already playing, do nothing
		if (currentTrackRef.current === trackId && bgmRef.current?.playing()) {
			return;
		}

		// Stop current BGM if playing
		if (bgmRef.current) {
			bgmRef.current.stop();
			bgmRef.current.unload();
		}

		// Create and play new track
		const sound = new Howl({
			src: [AUDIO_PATHS[trackId]],
			loop: true,
			volume: volume,
		});

		sound.play();
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
		<AudioContext.Provider value={{ playBGM, stopBGM, playSFX, setVolume }}>
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
