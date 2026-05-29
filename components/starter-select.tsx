"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	ALL_PUBMON,
	type PubMon,
	type PubType,
	TYPE_INFO,
} from "@/lib/pokemon-data";
import { useAudio } from "./audio-manager";
import PixelBox from "./pixel/PixelBox";
import PixelMenu from "./pixel/PixelMenu";
import PixelTextBox from "./pixel/PixelTextBox";
import { PixelSprite, TypeBadge } from "./pixel-sprite";
import { TrainerSprite } from "./trainer-sprite";
import { TypePokeball } from "./images/TypePokeball";

const STARTERS: Record<PubType, string> = {
	beer: "Hoppsin",
	shot: "Tequilar",
	wine: "Charderan",
	water: "Stillbar",
	cocktail: "Martini",
};

const TYPE_ORDER: PubType[] = ["beer", "shot", "wine", "water", "cocktail"];

interface StarterSelectProps {
	onSelect: (pokemon: PubMon) => void;
	name: string;
}

function ProfessorSprite() {
	return <TrainerSprite sprite="profbarley" size={96} />;
}

function PokeballRow() {
	return (
		<div className="flex items-center justify-center gap-[12px]">
			{TYPE_ORDER.map((type) => (
				<TypePokeball key={type} color={TYPE_INFO[type].color} />
			))}
		</div>
	);
}

export function StarterSelect({ onSelect, name }: StarterSelectProps) {
	const [phase, setPhase] = useState<"intro" | "pick" | "confirm" | "receive">(
		"intro",
	);
	const [dialogIdx, setDialogIdx] = useState(0);
	const [selectedType, setSelectedType] = useState<PubType | null>(null);
	const [selectedPokemon, setSelectedPokemon] = useState<PubMon | null>(null);
	const [textVisible, setTextVisible] = useState(true);
	const [audioStarted, setAudioStarted] = useState(false);

	const { playBGM, playCry } = useAudio();

	const introDialogs = [
		`Welcome to the world of PUBMON, ${name}!`,
		"My name is PROF. BARLEY. People call me the PubMon Professor!",
		"This world is inhabited by creatures known as PUBMON!",
		"People and PUBMON live together in pubs across the land.",
		"Your very own PUBMON adventure is about to begin!",
		"First, order your very first drink to choose a starter PUBMON!",
	];

	const startAudio = useCallback(() => {
		if (!audioStarted) {
			playBGM("pokemon-lab");
			setAudioStarted(true);
		}
	}, [audioStarted, playBGM]);

	useEffect(() => {
		// Try to play audio immediately if user has already interacted
		playBGM("pokemon-lab");
	}, [playBGM]);

	useEffect(() => {
		setTextVisible(false);
		const t = setTimeout(() => setTextVisible(true), 50);
		return () => clearTimeout(t);
	}, [dialogIdx, phase]);

	const advanceIntro = useCallback(() => {
		startAudio();
		if (dialogIdx < introDialogs.length - 1) {
			setDialogIdx((prev) => prev + 1);
		} else {
			setPhase("pick");
		}
	}, [dialogIdx, introDialogs.length, startAudio]);

	const handleTypeSelect = useCallback(
		(type: PubType) => {
			const starterName = STARTERS[type];
			const pokemon = ALL_PUBMON.find((p) => p.name === starterName);
			if (pokemon) {
				setSelectedType(type);
				setSelectedPokemon({ ...pokemon, hp: pokemon.maxHp });
				setPhase("confirm");
				playCry(pokemon.cry);
			}
		},
		[playCry],
	);

	const handleConfirm = useCallback(() => {
		if (selectedPokemon) {
			setPhase("receive");
			playCry(selectedPokemon.cry);
		}
	}, [selectedPokemon, playCry]);

	const handleFinalSelect = useCallback(() => {
		if (selectedPokemon) {
			onSelect(selectedPokemon);
		}
	}, [selectedPokemon, onSelect]);

	return (
		<div className="p-[2px] w-full">
			{/* Professor Scene (Shared for intro and pick phases) */}
			{(phase === "intro" || phase === "pick") && (
				<div className="mb-[4px]">
					<PixelBox className="flex items-center justify-center bg-[linear-gradient(to_top,#036672_0%,#036672_15%,#14b8a6_35%,#86efac_50%,#dcfce7_100%)]!">
						<div className="flex flex-col items-center py-[4px] gap-[4px]">
							<div className="relative w-[120px] h-[120px] flex items-center justify-center">
								<div className="absolute bottom-0 left-0 right-0 h-[8px] border-t-2 border-pixel-black bg-pixel-gray-light" />
								<div
									style={{
										animation:
											textVisible && phase === "intro"
												? "pixel-bounce 0.5s step-end infinite"
												: "none",
									}}
								>
									<ProfessorSprite />
								</div>
							</div>
							<PokeballRow />
						</div>
					</PixelBox>
				</div>
			)}

			{/* Intro Phase */}
			{phase === "intro" && (
				<button
					onClick={advanceIntro}
					className="w-full text-left cursor-pointer border-none bg-transparent p-0 flex flex-col focus:outline-none"
				>
					<PixelTextBox
						text={introDialogs[dialogIdx]}
						showContinue={true}
						rows={2}
					/>
				</button>
			)}

			{/* Pick Phase - choose drink type for starter */}
			{phase === "pick" && (
				<>
					<PixelTextBox
						text="Order your first drink! Each type comes with a starter PUBMON."
						showContinue={false}
						rows={2}
					/>

					<div className="mt-[4px]">
						<PixelBox>
							<div className="flex flex-col gap-[2px]">
								{TYPE_ORDER.map((type) => {
									const info = TYPE_INFO[type];
									const starterName = STARTERS[type];
									const starter = ALL_PUBMON.find(
										(p) => p.name === starterName,
									)!;
									return (
										<button
											key={type}
											onClick={() => handleTypeSelect(type)}
											className="group flex flex-row items-center cursor-pointer border-none bg-transparent hover:bg-pixel-gray-light p-[2px] text-left"
										>
											<div
												className="border-2 flex items-center justify-center bg-pixel-white mr-[4px]"
												style={{ borderColor: info.color }}
											>
												<PixelSprite
													name={starter.sprite}
													size={32}
													variant={starter.spriteVariant}
												/>
											</div>
											<div className="flex-1 overflow-hidden">
												<div className="flex items-center gap-[4px] mb-[2px]">
													<span className=" text-[8px] text-pixel-black">
														{info.label.toUpperCase()}
													</span>
													<span
														className=" text-[5px] px-[2px] py-[1px] text-pixel-white"
														style={{ backgroundColor: info.color }}
													>
														{info.element.toUpperCase()}
													</span>
												</div>
												<p className=" text-[6px] text-pixel-black m-0">
													{starterName.toUpperCase()}
												</p>
											</div>
											<span className=" text-[8px] opacity-0 group-hover:opacity-100">
												&gt;
											</span>
										</button>
									);
								})}
							</div>
						</PixelBox>
					</div>
				</>
			)}

			{/* Confirm Phase */}
			{phase === "confirm" && selectedPokemon && selectedType && (
				<>
					<PixelTextBox
						text={`So, you want ${selectedPokemon.name.toUpperCase()}?`}
						showContinue={false}
					/>

					<div className="my-[4px]">
						<PixelBox>
							<div className="flex flex-col items-center py-[2px]">
								<div className="flex items-center justify-center bg-pixel-white mb-[4px]">
									<PixelSprite
										name={selectedPokemon.sprite}
										size={64}
										animated
										variant={selectedPokemon.spriteVariant}
									/>
								</div>

								<span className=" text-pixel-sm text-pixel-black mb-[2px]">
									{selectedPokemon.name.toUpperCase()}
								</span>
								<TypeBadge type={selectedType} />

								<div className="w-full border-t-2 border-pixel-gray-light mt-[4px] pt-[2px]">
									<p className=" text-[6px] text-pixel-black text-center m-0 leading-tight">
										{selectedPokemon.description}
									</p>
								</div>
							</div>
						</PixelBox>
					</div>

					<div className="flex justify-end mt-[4px]">
						<div style={{ width: 60 }}>
							<PixelMenu
								items={["YES", "NO"]}
								onSelect={(i) => {
									if (i === 0) handleConfirm();
									else setPhase("pick");
								}}
							/>
						</div>
					</div>
				</>
			)}

			{/* Receive Phase - celebration */}
			{phase === "receive" && selectedPokemon && selectedType && (
				<>
					<PixelTextBox
						text={`You received ${selectedPokemon.name.toUpperCase()}!`}
						showContinue={false}
					/>

					<div className="my-[4px]">
						<PixelBox>
							<div className="flex justify-center items-center py-[16px] relative overflow-hidden h-[120px]">
								{/* Sparkle effects */}
								<div className="absolute inset-0 pointer-events-none">
									{Array.from({ length: 8 }).map((_, i) => (
										<div
											key={i}
											className="absolute w-[4px] h-[4px]"
											style={{
												left: `${15 + Math.random() * 70}%`,
												top: `${10 + Math.random() * 80}%`,
												backgroundColor: TYPE_INFO[selectedType].color,
												animation: `cursor-blink ${0.5 + Math.random() * 1}s step-end infinite`,
												animationDelay: `${Math.random() * 1}s`,
											}}
										/>
									))}
								</div>

								{/* Pokemon reveal */}
								<div
									className="flex items-center justify-center"
									style={{
										animation: "slide-in-left 0.5s ease-out",
									}}
								>
									<PixelSprite
										name={selectedPokemon.sprite}
										size={64}
										animated
										variant={selectedPokemon.spriteVariant}
									/>
								</div>
							</div>
						</PixelBox>
					</div>

					<div className="flex justify-end mt-[4px]">
						<div style={{ width: 60 }}>
							<PixelMenu items={["OK"]} onSelect={handleFinalSelect} />
						</div>
					</div>
				</>
			)}
		</div>
	);
}
