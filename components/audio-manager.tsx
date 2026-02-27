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
	playSFX: (trackId: TrackId | string) => void;
	playCry: (cryNumber: number) => void;
	playAttackSFX: (moveId: string) => void;
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

		// Use preloaded track if available, otherwise create new one
		const shouldFadeIn = hasCurrentMusic && trackId !== "battle";
		let sound = preloadedTracksRef.current.get(trackId);

		if (sound) {
			// Remove from preloaded cache as we're now using it
			preloadedTracksRef.current.delete(trackId);
			// Set proper volume
			sound.volume(shouldFadeIn ? 0 : volume);
		} else {
			// Fallback to creating new sound if not preloaded
			sound = new Howl({
				src: [AUDIO_PATHS[trackId]],
				loop: true,
				volume: shouldFadeIn ? 0 : volume,
			});
		}

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

	const playSFX = (trackId: TrackId | string) => {
		// Check if it's a predefined track ID
		const path = (trackId as TrackId) in AUDIO_PATHS
			? AUDIO_PATHS[trackId as TrackId]
			: `/audio/attacks/${trackId}.wav`;

		const sound = new Howl({
			src: [path],
			loop: false,
			volume: volume,
		});

		sound.play();
	};

	/**
	 * Format a Gen 1 move ID to match audio file naming convention
	 * Examples: 'hydropump' -> 'HydroPump', 'fireblast' -> 'FireBlast'
	 */
	const formatMoveNameForAudio = (moveId: string): string => {
		// Special cases for multi-word moves
		const specialCases: Record<string, string> = {
			'hydropump': 'HydroPump',
			'fireblast': 'FireBlast',
			'solarbeam': 'SolarBeam',
			'razorleaf': 'RazorLeaf',
			'bodyslam': 'BodySlam',
			'doubleedge': 'DoubleEdge',
			'megapunch': 'MegaPunch',
			'megadrain': 'MegaDrain',
			'takedown': 'TakeDown',
			'quickattack': 'QuickAttack',
			'confuseray': 'ConfuseRay',
			'leechseed': 'LeechSeed',
			'wingattack': 'WingAttack',
			'sandattack': 'SandAttack',
			'skyattack': 'SkyAttack',
			'hornattack': 'HornAttack',
			'horndrill': 'HornDrill',
			'focusenergy': 'FocusEnergy',
			'stunspore': 'StunSpore',
			'dizzypunch': 'DizzyPunch',
			'razorwind': 'RazorWind',
			'poisonpowder': 'PoisonPowder',
			'poisonsting': 'PoisonSting',
			'firespin': 'FireSpin',
			'aurorabeam': 'AuroraBeam',
			'defensecurl': 'DefenseCurl',
			'thundershock': 'ThunderShock',
			'doubleteam': 'DoubleTeam',
			'sleeppowder': 'SleepPowder',
			'swordsdance': 'SwordsDance',
			'tailwhip': 'TailWhip',
			'vinewhip': 'VineWhip',
			'lightscreen': 'LightScreen',
			'drillpeck': 'DrillPeck',
			'dreameater': 'DreamEater',
			'karatechop': 'KarateChop',
			'bubblebeam': 'Bubblebeam',
			'watergun': 'WaterGun',
			'jumpkick': 'JumpKick',
			'icepunch': 'IcePunch',
			'nightshade': 'NightShade',
		};

		if (specialCases[moveId.toLowerCase()]) {
			return specialCases[moveId.toLowerCase()];
		}

		// Default: capitalize first letter
		return moveId.charAt(0).toUpperCase() + moveId.slice(1);
	};

	const playAttackSFX = (moveId: string) => {
		const formattedName = formatMoveNameForAudio(moveId);
		const path = `/audio/attacks/${formattedName}.wav`;

		const sound = new Howl({
			src: [path],
			loop: false,
			volume: volume,
			// Gracefully handle missing audio files
			onloaderror: () => {
				console.warn(`Attack SFX not found: ${path}, falling back to Tackle`);
				// Fallback to a generic hit sound
				const fallbackSound = new Howl({
					src: ['/audio/attacks/Tackle.wav'],
					loop: false,
					volume: volume,
				});
				fallbackSound.play();
			},
		});

		sound.play();
	};

	const playCry = (cryNumber: number) => {
		// Use preloaded cry if available
		let sound = preloadedCriesRef.current.get(cryNumber);

		if (sound) {
			// Keep in cache for potential replays during battle
			sound.volume(volume);
			sound.play();
		} else {
			// Fallback to creating new sound if not preloaded
			const paddedNumber = cryNumber.toString().padStart(3, "0");
			sound = new Howl({
				src: [`/audio/cries/${paddedNumber}.wav`],
				loop: false,
				volume: volume,
			});
			sound.play();
		}
	};

	const setVolume = (newVolume: number) => {
		setVolumeState(newVolume);
		if (bgmRef.current) {
			bgmRef.current.volume(newVolume);
		}
	};

	// Pre-load battle music on mount
	useEffect(() => {
		preloadTrack("battle");
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (bgmRef.current) {
				bgmRef.current.stop();
				bgmRef.current.unload();
			}
			// Cleanup preloaded tracks
			preloadedTracksRef.current.forEach((sound) => {
				sound.unload();
			});
			preloadedTracksRef.current.clear();
			// Cleanup preloaded cries
			preloadedCriesRef.current.forEach((sound) => {
				sound.unload();
			});
			preloadedCriesRef.current.clear();
		};
	}, []);

	const preloadTrack = (trackId: TrackId) => {
		// Skip if already preloaded
		if (preloadedTracksRef.current.has(trackId)) {
			return;
		}

		const sound = new Howl({
			src: [AUDIO_PATHS[trackId]],
			loop: true,
			volume: 0,
			preload: true,
		});

		preloadedTracksRef.current.set(trackId, sound);
	};

	const preloadCry = (cryNumber: number) => {
		// Skip if already preloaded
		if (preloadedCriesRef.current.has(cryNumber)) {
			return;
		}

		const paddedNumber = cryNumber.toString().padStart(3, "0");
		const sound = new Howl({
			src: [`/audio/cries/${paddedNumber}.wav`],
			loop: false,
			volume: volume,
			preload: true,
		});

		preloadedCriesRef.current.set(cryNumber, sound);
	};

	return (
		<AudioContext.Provider value={{ playBGM, stopBGM, playSFX, playCry, playAttackSFX, preloadTrack, preloadCry, setVolume }}>
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
