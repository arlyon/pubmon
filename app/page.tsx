import { GameShell } from "@/components/game-shell";
import PixelScreen from "@/components/pixel/PixelScreen";

export default function Page() {
	return (
		<PixelScreen>
			<GameShell />
		</PixelScreen>
	);
}
