import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { GameNavbar } from "./game-navbar";

const meta = {
	title: "UI/GameNavbar",
	component: GameNavbar,
	parameters: { layout: "fullscreen" },
	args: {
		isHidden: false,
		activeTab: "crawl",
		onNavigate: fn(),
	},
	argTypes: {
		activeTab: {
			control: "radio",
			options: ["crawl", "pokedex", "team", "league", "settings"],
		},
	},
	decorators: [
		(Story) => (
			<div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100vh" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof GameNavbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Crawl: Story = {
	args: { activeTab: "crawl" },
};

export const Pokedex: Story = {
	args: { activeTab: "pokedex" },
};

export const Team: Story = {
	args: { activeTab: "team" },
};

export const League: Story = {
	args: { activeTab: "league" },
};

export const Settings: Story = {
	args: { activeTab: "settings" },
};

export const Hidden: Story = {
	args: { isHidden: true },
};
