import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { BattleScreenView } from "./battle-screen-view";
import type { PubMon } from "@/lib/pokemon-data";

const wildPokemon: PubMon = {
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

const playerPokemon: PubMon = {
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

const sampleMoves = [
	{ id: "grainslam", move: "Grain Slam", pp: 15, maxpp: 15, disabled: false },
	{ id: "headyfoam", move: "Heady Foam", pp: 10, maxpp: 15, disabled: false },
	{ id: "barrelroll", move: "Barrel Roll", pp: 8, maxpp: 15, disabled: false },
	{ id: "heavyhops", move: "Heavy Hops", pp: 15, maxpp: 15, disabled: false },
	{ id: "run", move: "Run", pp: 1, maxpp: 1, disabled: false },
	{ id: "catch", move: "Catch", pp: 1, maxpp: 1, disabled: false },
];

const meta = {
	title: "Pages/BattleScreen",
	component: BattleScreenView,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		wildPokemon,
		playerPokemon,
		menu: "main" as const,
		message: null,
		enemyHp: 38,
		playerHp: 35,
		isAnimating: false,
		introComplete: true,
		moves: sampleMoves,
		battleLog: [],
		onFight: fn(),
		onCatch: fn(),
		onBag: fn(),
		onRun: fn(),
		onSelectMove: fn(),
		onBackToMain: fn(),
		onContinueMessage: fn(),
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 420, margin: "0 auto" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof BattleScreenView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MainMenu: Story = {};

export const FightMenu: Story = {
	args: {
		menu: "fight",
	},
};

export const WithMessage: Story = {
	args: {
		menu: "message",
		message: "Hoppsin used Grain Slam!",
	},
};

export const EnemyLowHp: Story = {
	args: {
		enemyHp: 5,
	},
};

export const PlayerLowHp: Story = {
	args: {
		playerHp: 8,
	},
};

export const NoPokemon: Story = {
	args: {
		playerPokemon: null,
		moves: [],
	},
};

export const CatchAnimation: Story = {
	args: {
		showCatchAnim: true,
		menu: "message",
		message: "You threw a PubBall!",
	},
};

export const IntroSlideIn: Story = {
	args: {
		introComplete: false,
	},
};
