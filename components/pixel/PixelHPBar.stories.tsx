import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PixelHPBar from "./PixelHPBar";

const meta = {
	title: "Pixel/PixelHPBar",
	component: PixelHPBar,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div style={{ width: 200 }}>
				<Story />
			</div>
		),
	],
	args: {
		current: 35,
		max: 45,
		label: "HP",
		showNumbers: true,
	},
} satisfies Meta<typeof PixelHPBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
	args: { current: 45, max: 45 },
};

export const Damaged: Story = {
	args: { current: 35, max: 45 },
};

export const Warning: Story = {
	args: { current: 18, max: 45 },
};

export const Critical: Story = {
	args: { current: 5, max: 45 },
};

export const NoLabel: Story = {
	args: { label: undefined, current: 30, max: 45 },
};

export const NoNumbers: Story = {
	args: { showNumbers: false, current: 30, max: 45 },
};

export const AllStates: Story = {
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12, width: 200 }}>
			<PixelHPBar current={45} max={45} label="HP" />
			<PixelHPBar current={25} max={45} label="HP" />
			<PixelHPBar current={9} max={45} label="HP" />
			<PixelHPBar current={0} max={45} label="HP" />
		</div>
	),
};
