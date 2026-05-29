import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PixelBox from "./PixelBox";

const meta = {
	title: "Pixel/PixelBox",
	component: PixelBox,
	parameters: { layout: "centered" },
	args: {
		children: "Box content",
		variant: "default",
	},
	argTypes: {
		variant: { control: "radio", options: ["default", "blue", "red"] },
	},
} satisfies Meta<typeof PixelBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Blue: Story = {
	args: { variant: "blue", children: "Blue box content" },
};

export const Red: Story = {
	args: { variant: "red", children: "Red box content" },
};

export const AllVariants: Story = {
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<PixelBox variant="default">Default variant</PixelBox>
			<PixelBox variant="blue">Blue variant</PixelBox>
			<PixelBox variant="red">Red variant</PixelBox>
		</div>
	),
};

export const WithPadding: Story = {
	args: {
		className: "p-gba-[8]",
		children: "Box with gba-scale padding",
	},
};
