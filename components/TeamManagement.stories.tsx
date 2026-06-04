import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TeamManagement } from "./team-management";
import type { PubMon } from "@/lib/pokemon-data";

const team: PubMon[] = [
	{
		id: 1,
		name: "Hoppsin",
		type: "beer",
		hp: 45,
		maxHp: 45,
		level: 12,
		xp: 450,
		attack: 18,
		defense: 14,
		moves: ["Grain Slam", "Heady Foam", "Barrel Roll", "Heavy Hops"],
		sprite: "hoppsin",
		spriteVariant: 2,
		description: "A hoppy creature born from the finest barley fields.",
		visuals: "",
		cry: 24,
	},
	{
		id: 31,
		name: "Absinthia",
		type: "shot",
		hp: 28,
		maxHp: 50,
		level: 8,
		xp: 200,
		attack: 14,
		defense: 8,
		moves: ["Green Flame", "Wormwood Hex", "Spicy Spit", "Spirit Burn"],
		sprite: "absinthia",
		description: "A wild spirit creature wreathed in green flames.",
		visuals: "",
		cry: 63,
	},
	{
		id: 61,
		name: "Riesling",
		type: "wine",
		hp: 40,
		maxHp: 40,
		level: 6,
		xp: 100,
		attack: 10,
		defense: 16,
		moves: ["Oak Charm", "Grape Shot", "Cork Pop", "Vintage Curse"],
		sprite: "riesling",
		description: "A delicate vine creature with a sweet disposition.",
		visuals: "",
		cry: 45,
	},
	{
		id: 91,
		name: "Aquavit",
		type: "water",
		hp: 3,
		maxHp: 55,
		level: 10,
		xp: 350,
		attack: 13,
		defense: 13,
		moves: ["Tidal Pour", "Frost Bite", "Deep Rinse", "Spring Rush"],
		sprite: "aquavit",
		description: "A crystalline water spirit from frozen springs.",
		visuals: "",
		cry: 72,
	},
];

const meta = {
	title: "Pages/TeamManagement",
	component: TeamManagement,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		team,
		activeIndex: 0,
		onBack: fn(),
		onSetActive: fn(),
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof TeamManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyTeam: Story = {
	args: {
		team: [],
	},
};

export const FullTeam: Story = {
	args: {
		team: [
			...team,
			{
				id: 121,
				name: "Mojitoad",
				type: "cocktail",
				hp: 48,
				maxHp: 48,
				level: 9,
				xp: 300,
				attack: 15,
				defense: 11,
				moves: ["Mint Smash", "Lime Splash", "Sugar Rush", "Muddle Slam"],
				sprite: "mojitoad",
				description: "A refreshing amphibian that thrives in tropical bars.",
				visuals: "",
				cry: 29,
			},
			{
				id: 5,
				name: "Wheatley",
				type: "beer",
				hp: 50,
				maxHp: 50,
				level: 7,
				xp: 180,
				attack: 11,
				defense: 12,
				moves: ["Grain Slam", "Wood Splinter", "Fermenting Rest", "Hop Swing"],
				sprite: "wheatley",
				description: "A wheat-based creature with a cloudy demeanour.",
				visuals: "",
				cry: 52,
			},
		],
		activeIndex: 2,
	},
};

export const SinglePokemon: Story = {
	args: {
		team: [team[0]],
		activeIndex: 0,
	},
};
