"use client";

import Image from "next/image";
import type { PartySocket } from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTrainerSprite } from "@/lib/trainer-sprites";
import { useAudio } from "./audio-manager";
import PixelMenu from "./pixel/PixelMenu";
import PixelTextBox from "./pixel/PixelTextBox";
import { PixelBox } from "./pixel-box";
import { TrainerSprite } from "./trainer-sprite";

export interface PlayerInfo {
	name: string;
	gender: "boy" | "girl";
}

interface PlayerCreateProps {
	onComplete: (player: PlayerInfo, existingState?: any) => void;
	socket: PartySocket;
	sessionId: string;
}

function ProfessorSprite() {
	return <TrainerSprite sprite="profbarley" size={96} />;
}

type Phase = "welcome" | "gender" | "name" | "confirm" | "take_over_prompt";

export function PlayerCreate({
	onComplete,
	socket,
	sessionId,
}: PlayerCreateProps) {
	const [phase, setPhase] = useState<Phase>("welcome");
	const [dialogIdx, setDialogIdx] = useState(0);
	const [gender, setGender] = useState<"boy" | "girl" | null>(null);
	const [name, setName] = useState("");
	const [textVisible, setTextVisible] = useState(true);
	const [audioStarted, setAudioStarted] = useState(false);

	const { playBGM } = useAudio();

	const startAudio = useCallback(() => {
		if (!audioStarted) {
			playBGM("world-of-pokemon");
			setAudioStarted(true);
		}
	}, [audioStarted, playBGM]);

	const welcomeDialogs = [
		"Hello there!\nWelcome to the world of PUBMON!",
		"My name is PROF. BARLEY!",
		"People call me the PUBMON Professor!",
		"But enough about me.\nLet's talk about YOU!",
	];

	useEffect(() => {
		// Try to play audio immediately if user has already interacted
		playBGM("world-of-pokemon");
	}, [playBGM]);

	useEffect(() => {
		setTextVisible(false);
		const t = setTimeout(() => setTextVisible(true), 50);
		return () => clearTimeout(t);
	}, [dialogIdx, phase]);

	const advanceWelcome = useCallback(() => {
		startAudio();
		if (dialogIdx < welcomeDialogs.length - 1) {
			setDialogIdx((prev) => prev + 1);
		} else {
			setPhase("gender");
		}
	}, [dialogIdx, welcomeDialogs.length, startAudio]);

	const handleGenderSelect = useCallback((g: "boy" | "girl") => {
		setGender(g);
		setPhase("name");
	}, []);

	const handleNameSubmit = useCallback(() => {
		if (name.trim().length > 0) {
			// Send check_name message to server
			socket.send(
				JSON.stringify({
					type: "check_name",
					name: name.trim().toUpperCase(),
				}),
			);

			// Listen for response
			const handleMessage = (event: MessageEvent) => {
				const msg = JSON.parse(event.data);
				if (msg.type === "name_status") {
					if (msg.available) {
						setPhase("confirm");
					} else {
						setPhase("take_over_prompt");
					}
					socket.removeEventListener("message", handleMessage);
				}
			};

			socket.addEventListener("message", handleMessage);
		}
	}, [name, socket]);

	const handleConfirm = useCallback(() => {
		if (gender && name.trim()) {
			// Get the appropriate sprite (tries custom sprite, falls back on render)
			const sprite = getTrainerSprite(name.trim(), gender);

			// Send create_player message
			socket.send(
				JSON.stringify({
					type: "create_player",
					sessionId,
					playerInfo: {
						name: name.trim().toUpperCase(),
						sprite,
					},
				}),
			);

			// Listen for response (either player_created for new players or player_state for returning users)
			const handleMessage = (event: MessageEvent) => {
				const msg = JSON.parse(event.data);

				console.log("waiting for message", event);
				if (msg.type === "player_created" || msg.type === "player_state") {
					// For player_state, pass the existing state
					const existingState =
						msg.type === "player_state" ? msg.playerState : undefined;
					onComplete(
						{ name: name.trim().toUpperCase(), gender },
						existingState,
					);
					socket.removeEventListener("message", handleMessage);
				} else if (msg.type === "error") {
					// Handle error (e.g., name already taken due to race condition)
					alert(msg.message);
					setPhase("name");
					socket.removeEventListener("message", handleMessage);
				}
			};

			socket.addEventListener("message", handleMessage);
		}
	}, [gender, name, onComplete, socket, sessionId]);

	const handleTakeOver = useCallback(() => {
		// Send claim_player message
		socket.send(
			JSON.stringify({
				type: "claim_player",
				name: name.trim().toUpperCase(),
				newSessionId: sessionId,
			}),
		);

		// Listen for player_state response
		const handleMessage = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "player_state") {
				if (gender) {
					// Pass both the basic player info and the full state
					onComplete(
						{ name: name.trim().toUpperCase(), gender },
						msg.playerState,
					);
				}
				socket.removeEventListener("message", handleMessage);
			}
		};

		socket.addEventListener("message", handleMessage);
	}, [name, sessionId, socket, gender, onComplete]);

	const handleRejectTakeOver = useCallback(() => {
		setPhase("name");
		setName("");
	}, []);

	const handleBack = useCallback(() => {
		if (phase === "name") setPhase("gender");
		else if (phase === "confirm") setPhase("name");
	}, [phase]);

	return (
		<div className="p-[2px] w-full">
			{/* Professor Scene (Shared for multiple phases) */}
			{(phase === "welcome" || phase === "gender" || phase === "confirm") && (
				<div>
					<PixelBox className="flex items-center justify-center bg-[linear-gradient(to_top,#036672_0%,#036672_15%,#14b8a6_35%,#86efac_50%,#dcfce7_100%)]! p-2">
						<div className="flex flex-col items-center">
							<div
								style={{
									animation: "pixel-bounce 0.5s step-end infinite",
								}}
							>
								<ProfessorSprite />
							</div>
						</div>
					</PixelBox>
				</div>
			)}

			{/* Player Scene (Name phase) */}
			{phase === "name" && gender && (
				<div>
					<PixelBox className="flex items-center justify-center bg-[linear-gradient(to_top,#036672_0%,#036672_15%,#14b8a6_35%,#86efac_50%,#dcfce7_100%)]! p-2">
						<div className="flex flex-col items-center">
							<TrainerSprite sprite="" gender={gender} size={64} />
						</div>
					</PixelBox>
				</div>
			)}

			{/* Welcome Phase */}
			{phase === "welcome" && (
				<button
					onClick={advanceWelcome}
					className="w-full text-left cursor-pointer border-none bg-transparent p-0 flex flex-col focus:outline-none"
				>
					<PixelTextBox
						text={welcomeDialogs[dialogIdx]}
						showContinue={true}
						rows={2}
					/>
				</button>
			)}

			{/* Gender Selection Phase */}
			{phase === "gender" && (
				<>
					<div className="absolute top-20 right-10">
						<PixelMenu
							items={["BOY", "GIRL"]}
							onSelect={(i) => handleGenderSelect(i === 0 ? "boy" : "girl")}
						/>
					</div>

					<PixelTextBox
						text="Now tell me, are you a boy? Or are you a girl?"
						showContinue={false}
						rows={2}
					/>
				</>
			)}

			{/* Name Input Phase */}
			{phase === "name" && gender && (
				<>
					<PixelTextBox
						text={`Right, so you're a ${gender}.\nWhat is your name?`}
						showContinue={false}
					/>

					<div className="mt-[4px]">
						<PixelBox className="p-2">
							<div className="flex flex-col gap-[4px]">
								<div className="bg-pixel-white border-2 border-pixel-black p-[4px]">
									<input
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value.slice(0, 10))}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleNameSubmit();
										}}
										placeholder="YOUR NAME"
										maxLength={10}
										autoFocus
										className="w-full bg-transparent  text-pixel-xs text-pixel-black text-center outline-none uppercase"
									/>
								</div>
								<div className="flex justify-between">
									<span className=" text-[6px] text-pixel-gray">
										{name.length}/10
									</span>
								</div>

								<div className="flex justify-between mt-[2px] items-end">
									<button
										onClick={handleBack}
										className="border-none bg-transparent cursor-pointer  text-[6px] text-pixel-gray underline hover:text-pixel-black"
									>
										BACK
									</button>

									<div style={{ width: 60 }}>
										<PixelMenu items={["OK"]} onSelect={handleNameSubmit} />
									</div>
								</div>
							</div>
						</PixelBox>
					</div>
				</>
			)}

			{/* Confirm Phase */}
			{phase === "confirm" && gender && (
				<>
					<PixelTextBox
						text={`So your name is ${name.trim().toUpperCase()}?`}
						showContinue={false}
					/>

					<div className="mt-[4px] flex justify-end">
						<div style={{ width: 60 }}>
							<PixelMenu
								items={["YES", "NO"]}
								onSelect={(i) => {
									if (i === 0) handleConfirm();
									else handleBack();
								}}
							/>
						</div>
					</div>
				</>
			)}

			{/* Take Over Prompt Phase */}
			{phase === "take_over_prompt" && gender && (
				<>
					<div>
						<PixelBox className="flex items-center justify-center bg-[linear-gradient(to_top,#036672_0%,#036672_15%,#14b8a6_35%,#86efac_50%,#dcfce7_100%)]! p-2">
							<div className="flex flex-col items-center">
								<div
									style={{
										animation: "pixel-bounce 0.5s step-end infinite",
									}}
								>
									<ProfessorSprite />
								</div>
							</div>
						</PixelBox>
					</div>

					<PixelTextBox
						text={`Character ${name.trim().toUpperCase()} already exists.\nAre you this player?`}
						showContinue={false}
					/>

					<div className="mt-[4px] flex justify-end">
						<div style={{ width: 90 }}>
							<PixelMenu
								items={["YES", "NO"]}
								onSelect={(i) => {
									if (i === 0) handleTakeOver();
									else handleRejectTakeOver();
								}}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
