import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PixelButton } from "../pixel-box";

// NOTE: PixelBox in pixel-box.tsx (Tailwind-based, used by pages) is a
// separate component from components/pixel/PixelBox.tsx (CSS-class-based,
// used by PixelMenu/PixelTextBox). These should be consolidated.

const meta = {
	title: "Pixel/PixelButton",
	component: PixelButton,
	parameters: { layout: "centered" },
	args: {
		children: "Button",
		onClick: fn(),
		variant: "default",
		disabled: false,
	},
	argTypes: {
		variant: {
			control: "radio",
			options: ["default", "primary", "danger", "type"],
		},
	},
} satisfies Meta<typeof PixelButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
	args: { variant: "primary", children: "Confirm" },
};

export const Danger: Story = {
	args: { variant: "danger", children: "Delete" },
};

export const Type: Story = {
	args: { variant: "type", children: "BEER" },
};

export const Disabled: Story = {
	args: { disabled: true, children: "Unavailable" },
};

export const AllVariants: Story = {
	render: () => (
		<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
			<PixelButton variant="default" onClick={fn()}>Default</PixelButton>
			<PixelButton variant="primary" onClick={fn()}>Primary</PixelButton>
			<PixelButton variant="danger" onClick={fn()}>Danger</PixelButton>
			<PixelButton variant="type" onClick={fn()}>Type</PixelButton>
			<PixelButton variant="primary" onClick={fn()} disabled>Disabled</PixelButton>
		</div>
	),
};
