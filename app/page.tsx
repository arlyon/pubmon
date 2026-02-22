import { cookies } from "next/headers";
import { GameShell } from "@/components/game-shell";
import PixelScreen from "@/components/pixel/PixelScreen";
import type { MainEventServer } from "../src/servers/MainEventServer";

async function getPlayerState() {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get("pubmon_session_id")?.value;

	if (!sessionId) {
		return null;
	}

	try {
		// Fetch player state from Durable Object
		const response = await fetch(
			`http://localhost:8787/parties/main/rpc/player/${sessionId}`,
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

export default async function Page() {
	const initialPlayerState = await getPlayerState();

	console.log("initialPlayerState", initialPlayerState);

	return (
		<PixelScreen>
			<GameShell initialPlayerState={initialPlayerState} />
		</PixelScreen>
	);
}
