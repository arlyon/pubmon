import plugin from "tailwindcss/plugin";

export default plugin(function ({ matchUtilities }) {
	matchUtilities({
		"w-gba": (value) => ({
			width: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"h-gba": (value) => ({
			height: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"text-gba": (value) => ({
			fontSize: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"p-gba": (value) => ({
			padding: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"px-gba": (value) => ({
			paddingLeft: `calc(${value} * 1px * var(--pixel-scale))`,
			paddingRight: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"py-gba": (value) => ({
			paddingTop: `calc(${value} * 1px * var(--pixel-scale))`,
			paddingBottom: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"mt-gba": (value) => ({
			marginTop: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"m-gba": (value) => ({
			margin: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"gap-gba": (value) => ({
			gap: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"border-gba": (value) => ({
			borderWidth: `calc(${value} * 1px * var(--pixel-scale))`,
		}),
		"size-gba": value => ({
		width:  `calc(${value} * 1px * var(--pixel-scale))`,
		height:  `calc(${value} * 1px * var(--pixel-scale))`,
		})
	});
});
