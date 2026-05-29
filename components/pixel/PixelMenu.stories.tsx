import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import PixelMenu from "./PixelMenu";

const meta = {
	title: "Pixel/PixelMenu",
	component: PixelMenu,
	parameters: { layout: "centered" },
	args: {
		items: ["FIGHT", "BAG", "PUBMON", "RUN"],
		onSelect: fn(),
		variant: "default",
	},
	argTypes: {
		variant: { control: "radio", options: ["default", "blue", "red"] },
	},
} satisfies Meta<typeof PixelMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Blue: Story = {
	args: { variant: "blue" },
};

export const Red: Story = {
	args: { variant: "red" },
};

export const BattleMenu: Story = {
	args: {
		items: ["FIGHT", "BAG", "PUBMON", "RUN"],
		variant: "default",
	},
};

export const MoveMenu: Story = {
	args: {
		items: ["Grain Slam", "Heady Foam", "Barrel Roll", "Heavy Hops"],
		variant: "default",
	},
};

export const SingleItem: Story = {
	args: { items: ["CONTINUE"] },
};

export const AllVariants: Story = {
	render: () => (
		<div style={{ display: "flex", gap: 12 }}>
			<PixelMenu items={["FIGHT", "BAG", "RUN"]} variant="default" onSelect={fn()} />
			<PixelMenu items={["FIGHT", "BAG", "RUN"]} variant="blue" onSelect={fn()} />
			<PixelMenu items={["FIGHT", "BAG", "RUN"]} variant="red" onSelect={fn()} />
		</div>
	),
};
