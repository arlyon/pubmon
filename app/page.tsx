import { cookies } from "next/headers";
import { GameShell } from "@/components/game-shell";
import PixelScreen from "@/components/pixel/PixelScreen";

async function getPlayerState() {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get("pubmon_session_id")?.value;

	if (!sessionId) {
		return null;
	}

	try {
		// Fetch player state from Durable Object
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787"}/parties/main/rpc/player/${sessionId}`,
			{
				cache: "no-store",
			},
		);

		if (!response.ok) {
			console.error(
				"Failed to fetch player state:",
				sessionId,
				response.statusText,
			);
			return null;
		}

		return await response.json();
	} catch (error) {
		console.error("Failed to fetch player state:", error);
		return null;
	}
}

async function getGameState() {
	try {
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787"}/parties/main/rpc/gym`,
			{
				cache: "no-store",
			},
		);

		if (!response.ok) {
			console.error("Failed to fetch game state:", response.statusText);
			return { currentGymId: 1, gamePhase: "collection" as const };
		}

		const data = await response.json();
		return {
			currentGymId: data.currentGymId,
			gamePhase:
				data.gamePhase ||
				("collection" as "collection" | "tournament" | "hall-of-fame"),
		};
	} catch (error) {
		console.error("Failed to fetch game state:", error);
		return { currentGymId: 1, gamePhase: "collection" as const };
	}
}

export default async function Page() {
	const [initialPlayerState, gameState] = await Promise.all([
		getPlayerState(),
		getGameState(),
	]);

	return (
		<PixelScreen>
			<GameShell
				initialPlayerState={initialPlayerState}
				initialGymId={gameState.currentGymId}
				initialGamePhase={gameState.gamePhase}
			/>
		</PixelScreen>
	);
}
