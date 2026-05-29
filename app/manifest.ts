import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "PubMon - Pub Crawl Battle Game",
		short_name: "PubMon",
		description:
			"Catch drink-themed PubMon on your pub crawl adventure! A retro pixel-art battle game.",
		start_url: "/",
		display: "standalone",
		background_color: "#1a1c2c",
		theme_color: "#1a1c2c",
		orientation: "portrait",
		icons: [
			{
				src: "/icon-light-32x32.png",
				sizes: "32x32",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icon-dark-32x32.png",
				sizes: "32x32",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/apple-icon.png",
				sizes: "180x180",
				type: "image/png",
				purpose: "any maskable",
			},
			{
				src: "/icon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
		],
		categories: ["games", "entertainment"],
		scope: "/",
	};
}
