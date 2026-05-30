import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SettingsPanel } from "./settings-panel";

const meta = {
	title: "Pages/SettingsPanel",
	component: SettingsPanel,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		isMuted: false,
		onToggleMute: fn(),
		uiScale: 1,
		onScaleChange: fn(),
		sessionId: "story-session",
		party: [],
	},
	decorators: [
		(Story) => (
			<div
				style={{
					maxWidth: 420,
					margin: "0 auto",
					height: "100vh",
					display: "flex",
				}}
			>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Muted: Story = {
	args: {
		isMuted: true,
	},
};
