import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PixelTextBox from "./PixelTextBox";

const meta = {
	title: "Pixel/PixelTextBox",
	component: PixelTextBox,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div style={{ width: 280 }}>
				<Story />
			</div>
		),
	],
	args: {
		text: "A wild ABSINTHIA appeared!",
		showContinue: true,
	},
} satisfies Meta<typeof PixelTextBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoContinue: Story = {
	args: { showContinue: false, text: "ABSINTHIA fainted!" },
};

export const MultiLine: Story = {
	args: {
		text: "HOPPSIN used\nGRAIN SLAM!\nIt's super effective!",
		showContinue: true,
	},
};

export const LongMessage: Story = {
	args: {
		text: "The wild ABSINTHIA used WORMWOOD HEX! HOPPSIN's accuracy fell!",
		showContinue: true,
	},
};

export const FixedRows: Story = {
	args: {
		text: "Waiting...",
		rows: 3,
		showContinue: false,
	},
};
