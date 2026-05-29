import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Pokedex } from "./pokedex";

const meta = {
	title: "Pages/Pokedex",
	component: Pokedex,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		onBack: fn(),
		seenIds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 31, 32, 33, 61, 62, 91, 92]),
		caughtIds: new Set([1, 2, 3, 31, 61]),
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 420, margin: "0 auto", height: "100vh" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Pokedex>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
	args: {
		seenIds: new Set<number>(),
		caughtIds: new Set<number>(),
	},
};

export const AllSeen: Story = {
	args: {
		seenIds: new Set(Array.from({ length: 151 }, (_, i) => i + 1)),
		caughtIds: new Set(Array.from({ length: 80 }, (_, i) => i + 1)),
	},
};

export const FewCaught: Story = {
	args: {
		seenIds: new Set([1, 2, 3]),
		caughtIds: new Set([1]),
	},
};
