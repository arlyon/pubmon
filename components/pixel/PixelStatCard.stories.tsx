import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PixelStatCard from "./PixelStatCard";
import type { PubMon } from "@/lib/pokemon-data";

const hoppsin: PubMon = {
	id: 1,
	name: "Hoppsin",
	type: "beer",
	hp: 35,
	maxHp: 45,
	level: 7,
	xp: 200,
	attack: 12,
	defense: 10,
	moves: ["Grain Slam", "Heady Foam", "Barrel Roll", "Heavy Hops"],
	sprite: "hoppsin",
	spriteVariant: 2,
	description: "A hoppy creature born from the finest barley fields.",
	visuals: "",
	cry: 24,
};

const absinthia: PubMon = {
	id: 31,
	name: "Absinthia",
	type: "shot",
	hp: 38,
	maxHp: 50,
	level: 8,
	xp: 0,
	attack: 14,
	defense: 8,
	moves: ["Green Flame", "Wormwood Hex", "Spicy Spit", "Spirit Burn"],
	sprite: "absinthia",
	description: "A wild spirit creature wreathed in green flames.",
	visuals: "",
	cry: 63,
};

const meta = {
	title: "Pixel/PixelStatCard",
	component: PixelStatCard,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div style={{ width: 200 }}>
				<Story />
			</div>
		),
	],
	args: {
		pokemon: hoppsin,
		currentHp: 35,
		showHpNumbers: true,
	},
} satisfies Meta<typeof PixelStatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
	args: { currentHp: 45, pokemon: { ...hoppsin, maxHp: 45 } },
};

export const Damaged: Story = {};

export const Critical: Story = {
	args: { currentHp: 5 },
};

export const WithStatus: Story = {
	name: "With Status — Burned",
	args: { status: "brn", currentHp: 28 },
};

export const AllStatuses: Story = {
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12, width: 220 }}>
			{(["brn", "psn", "par", "slp", "frz"] as const).map((status) => (
				<PixelStatCard
					key={status}
					pokemon={hoppsin}
					currentHp={30}
					status={status}
				/>
			))}
		</div>
	),
};

export const ShotType: Story = {
	args: { pokemon: absinthia, currentHp: 38 },
};

export const NoHpNumbers: Story = {
	args: { showHpNumbers: false, currentHp: 20 },
};

export const LevelOverride: Story = {
	args: { level: 50, currentHp: 45 },
};
