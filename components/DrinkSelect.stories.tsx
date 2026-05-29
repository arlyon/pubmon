import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DrinkSelect } from "./drink-select";
import type { PubMon } from "@/lib/pokemon-data";

const samplePubmon: PubMon = {
	id: 1,
	name: "Hoppsin",
	type: "beer",
	hp: 45,
	maxHp: 45,
	level: 5,
	xp: 30,
	attack: 12,
	defense: 10,
	moves: ["Grain Slam", "Heady Foam", "Barrel Roll", "Heavy Hops"],
	sprite: "hoppsin",
	spriteVariant: 2,
	description: "A hoppy creature born from the finest barley fields.",
	visuals: "",
	cry: 24,
};

const meta = {
	title: "Pages/DrinkSelect",
	component: DrinkSelect,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		onSelect: fn(),
		onSelectGym: fn(),
		onJoinBattle: fn(),
		drinksCollected: 12,
		currentGymId: 1,
		badges: new Set<number>([1, 2]),
		activePubmon: samplePubmon,
		pokedexSeen: 23,
		pokedexTotal: 151,
		playerName: "ASH",
		playerGender: "boy" as const,
		gamePhase: "collection" as const,
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DrinkSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPubmon: Story = {
	args: {
		activePubmon: null,
		drinksCollected: 0,
		badges: new Set<number>(),
		pokedexSeen: 0,
	},
};

export const ManyBadges: Story = {
	args: {
		drinksCollected: 47,
		badges: new Set([1, 2, 3, 4, 5, 6, 7]),
		pokedexSeen: 89,
		activePubmon: { ...samplePubmon, level: 32, xp: 1200 },
	},
};

export const TournamentPhase: Story = {
	args: {
		gamePhase: "tournament",
		activeBattleId: "battle-123",
		activeBattleOpponent: "GARY",
	},
};
