"use client";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import PixelTransition, {
	barBlindsTransition,
	circleWipeTransition,
	verticalBlindsTransition,
} from "./PixelTransition";
import { PixelButton } from "../pixel-box";

function TransitionDemo({
	label,
	config,
}: {
	label: string;
	config: ReturnType<typeof barBlindsTransition>;
}) {
	const [active, setActive] = useState(false);
	return (
		<div style={{ position: "relative", width: 320, height: 240, background: "#d8e0e8", border: "1px solid #282828" }}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
				<PixelButton
					variant="primary"
					onClick={() => setActive(true)}
					disabled={active}
				>
					{label}
				</PixelButton>
			</div>
			<PixelTransition
				transition={config}
				active={active}
				onComplete={() => setActive(false)}
				width={320}
				height={240}
			/>
		</div>
	);
}

const meta = {
	title: "Pixel/PixelTransition",
	component: PixelTransition,
	parameters: { layout: "centered" },
} satisfies Meta<typeof PixelTransition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BarBlinds: Story = {
	render: () => (
		<TransitionDemo label="Bar Blinds" config={barBlindsTransition()} />
	),
};

export const CircleWipe: Story = {
	render: () => (
		<TransitionDemo label="Circle Wipe" config={circleWipeTransition()} />
	),
};

export const VerticalBlinds: Story = {
	render: () => (
		<TransitionDemo label="Vertical Blinds" config={verticalBlindsTransition()} />
	),
};

export const AllTransitions: Story = {
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<TransitionDemo label="Bar Blinds" config={barBlindsTransition()} />
			<TransitionDemo label="Circle Wipe" config={circleWipeTransition()} />
			<TransitionDemo label="Vertical Blinds" config={verticalBlindsTransition()} />
		</div>
	),
};
