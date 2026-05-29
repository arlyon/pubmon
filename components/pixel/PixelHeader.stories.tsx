import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PixelHeader from "./PixelHeader";

const meta = {
	title: "Pixel/PixelHeader",
	component: PixelHeader,
	parameters: { layout: "fullscreen" },
	args: {
		title: "PUBMON",
		subtitle: "YOUR PARTY",
		variant: "blue",
	},
	argTypes: {
		variant: { control: "radio", options: ["blue", "red", "dark", "gray"] },
	},
} satisfies Meta<typeof PixelHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blue: Story = {};

export const Red: Story = {
	args: { variant: "red", title: "PUBDEX", subtitle: "PUBMON DIRECTORY" },
};

export const Dark: Story = {
	args: { variant: "dark", title: "HALL OF CHAMPS", subtitle: "LEADERBOARD" },
};

export const Gray: Story = {
	args: { variant: "gray", title: "OPTIONS", subtitle: "SETTINGS" },
};

export const WithRight: Story = {
	args: {
		variant: "red",
		title: "PUBDEX",
		subtitle: "PUBMON DIRECTORY",
		right: (
			<div className="bg-pixel-black px-gba-[6] py-gba-[3] text-gba-[7] border border-pixel-white font-palette-yellow">
				42/151
			</div>
		),
	},
};

export const AllVariants: Story = {
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			<PixelHeader title="PUBMON" subtitle="YOUR PARTY" variant="blue" />
			<PixelHeader title="PUBDEX" subtitle="PUBMON DIRECTORY" variant="red" />
			<PixelHeader title="HALL OF CHAMPS" subtitle="LEADERBOARD" variant="dark" />
			<PixelHeader title="OPTIONS" subtitle="SETTINGS" variant="gray" />
		</div>
	),
};
