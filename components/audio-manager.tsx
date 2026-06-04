"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Howl, Howler } from "howler";

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
	playCry: (cryNumber: number, requireLoaded?: boolean) => void;
	playAttackSFX: (moveId: string) => void;
	preloadTrack: (trackId: TrackId) => void;
	preloadCry: (cryNumber: number) => void;
	setVolume: (volume: number) => void;
	isMuted: boolean;
	toggleMute: () => void;
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
	const [volume, setVolumeState] = useState(() => {
		if (typeof window === "undefined") return 0.5;
		const saved = localStorage.getItem("pubmon_volume");
		return saved !== null ? parseFloat(saved) : 0.5;
	});
	const [isMuted, setIsMuted] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem("pubmon_muted") === "true";
	});

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

		sound.mute(isMuted);
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

	const playSFX = (trackId: TrackId | string, duck = false) => {
		// Check if it's a predefined track ID
		const path =
			(trackId as TrackId) in AUDIO_PATHS
				? AUDIO_PATHS[trackId as TrackId]
				: `/audio/attacks/${trackId}.wav`;

		// Duck the BGM while the SFX plays
		if (duck && bgmRef.current) {
			bgmRef.current.fade(bgmRef.current.volume(), volume * 0.25, 300);
		}

		const sound = new Howl({
			src: [path],
			loop: false,
			volume: volume,
			onend: () => {
				if (duck && bgmRef.current) {
					bgmRef.current.fade(bgmRef.current.volume(), volume, 600);
				}
			},
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
			hydropump: "HydroPump",
			fireblast: "FireBlast",
			solarbeam: "SolarBeam",
			razorleaf: "RazorLeaf",
			bodyslam: "BodySlam",
			doubleedge: "DoubleEdge",
			megapunch: "MegaPunch",
			megadrain: "MegaDrain",
			takedown: "TakeDown",
			quickattack: "QuickAttack",
			confuseray: "ConfuseRay",
			leechseed: "LeechSeed",
			wingattack: "WingAttack",
			sandattack: "SandAttack",
			skyattack: "SkyAttack",
			hornattack: "HornAttack",
			horndrill: "HornDrill",
			focusenergy: "FocusEnergy",
			stunspore: "StunSpore",
			dizzypunch: "DizzyPunch",
			razorwind: "RazorWind",
			poisonpowder: "PoisonPowder",
			poisonsting: "PoisonSting",
			firespin: "FireSpin",
			aurorabeam: "AuroraBeam",
			defensecurl: "DefenseCurl",
			thundershock: "ThunderShock",
			doubleteam: "DoubleTeam",
			sleeppowder: "SleepPowder",
			swordsdance: "SwordsDance",
			tailwhip: "TailWhip",
			vinewhip: "VineWhip",
			lightscreen: "LightScreen",
			drillpeck: "DrillPeck",
			dreameater: "DreamEater",
			karatechop: "KarateChop",
			bubblebeam: "Bubblebeam",
			watergun: "WaterGun",
			jumpkick: "JumpKick",
			icepunch: "IcePunch",
			nightshade: "NightShade",
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
					src: ["/audio/attacks/Tackle.wav"],
					loop: false,
					volume: volume,
				});
				fallbackSound.play();
			},
		});

		sound.play();
	};

	const playCry = (cryNumber: number, requireLoaded = false) => {
		// Use preloaded cry if available
		let sound = preloadedCriesRef.current.get(cryNumber);

		if (sound) {
			// When requireLoaded (e.g. the intro), never block waiting on the
			// cry — if it hasn't finished loading yet, just skip it.
			if (requireLoaded && sound.state() !== "loaded") return;
			// Keep in cache for potential replays during battle
			sound.volume(volume);
			sound.play();
			return;
		}

		// Not preloaded. For time-sensitive callers (requireLoaded) we skip
		// rather than lazy-load and play late.
		if (requireLoaded) return;

		// Fallback to creating new sound if not preloaded (e.g. battle cries)
		const paddedNumber = cryNumber.toString().padStart(3, "0");
		sound = new Howl({
			src: [`/audio/cries/${paddedNumber}.wav`],
			loop: false,
			volume: volume,
		});
		sound.play();
	};

	const setVolume = (newVolume: number) => {
		setVolumeState(newVolume);
		localStorage.setItem("pubmon_volume", String(newVolume));
		if (bgmRef.current) {
			bgmRef.current.volume(newVolume);
		}
	};

	const toggleMute = () => {
		const next = !isMuted;
		setIsMuted(next);
		localStorage.setItem("pubmon_muted", String(next));
		if (bgmRef.current) {
			bgmRef.current.mute(next);
		}
	};

	// Apply persisted mute state on mount
	useEffect(() => {
		if (bgmRef.current) {
			bgmRef.current.mute(isMuted);
		}
	}, []);

	// Pause BGM when the tab is hidden, resume when it returns
	useEffect(() => {
		const wasPlayingRef = { current: false };
		const handleVisibilityChange = () => {
			if (document.hidden) {
				if (bgmRef.current?.playing()) {
					wasPlayingRef.current = true;
					bgmRef.current.pause();
				}
			} else if (wasPlayingRef.current) {
				wasPlayingRef.current = false;
				bgmRef.current?.play();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, []);

	// Pre-load intro + battle audio on mount
	useEffect(() => {
		preloadTrack("title-screen");
		preloadTrack("world-of-pokemon");
		preloadTrack("pokemon-lab");
		preloadTrack("battle");
		preloadCry(29); // Mojitoad cry for intro

		// Unlock AudioContext on first user gesture so audio plays freely after.
		// In standalone PWA mode, Chrome/Safari are more lenient, but a gesture
		// is still required on first cold start.
		const unlock = () => {
			const ctx = (Howler as any).ctx as AudioContext | undefined;
			if (ctx?.state === "suspended") {
				ctx.resume();
			}
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
		};
		window.addEventListener("pointerdown", unlock, { once: true });
		window.addEventListener("keydown", unlock, { once: true });
		return () => {
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
		};
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
		<AudioContext.Provider
			value={{
				playBGM,
				stopBGM,
				playSFX,
				playCry,
				playAttackSFX,
				preloadTrack,
				preloadCry,
				setVolume,
				isMuted,
				toggleMute,
			}}
		>
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
