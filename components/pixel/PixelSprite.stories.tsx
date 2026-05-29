import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PixelSprite, TypeBadge } from "../pixel-sprite";
import type { PubType } from "@/lib/pokemon-data";

// ── PixelSprite ────────────────────────────────────────────────────────────

const spriteMeta = {
	title: "Pixel/PixelSprite",
	component: PixelSprite,
	parameters: { layout: "centered" },
	args: {
		name: "hoppsin",
		size: 56,
		flipped: false,
		animated: false,
		variant: 1,
	},
} satisfies Meta<typeof PixelSprite>;

export default spriteMeta;
type SpriteStory = StoryObj<typeof spriteMeta>;

export const Default: SpriteStory = {};

export const Flipped: SpriteStory = {
	args: { flipped: true },
};

export const Animated: SpriteStory = {
	args: { animated: true },
};

export const Large: SpriteStory = {
	args: { size: 96 },
};

export const AllTypes: SpriteStory = {
	render: () => (
		<div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
			{(["beer", "shot", "wine", "water", "cocktail"] as PubType[]).map((type) => (
				<div key={type} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
					<TypeBadge type={type} />
				</div>
			))}
		</div>
	),
};
