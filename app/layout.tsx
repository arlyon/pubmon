import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { PWADebug } from "@/components/pwa-debug";
import { PWAInstaller } from "@/components/pwa-installer";
import "./globals.css";

const pixelFont = Press_Start_2P({
	weight: "400",
	subsets: ["latin"],
	variable: "--",
});

const emeraldFont = localFont({
	src: "../public/Emerald.ttf",
	variable: "--font-emerald",
});

export const metadata: Metadata = {
	title: "PubMon - Pub Crawl Battle Game",
	description:
		"Catch drink-themed PubMon on your pub crawl adventure! A retro pixel-art battle game.",
	generator: "v0.app",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "PubMon",
	},
	applicationName: "PubMon",
	icons: {
		icon: [
			{
				url: "/icon-light-32x32.png",
				media: "(prefers-color-scheme: light)",
			},
			{
				url: "/icon-dark-32x32.png",
				media: "(prefers-color-scheme: dark)",
			},
			{
				url: "/icon.svg",
				type: "image/svg+xml",
			},
		],
		apple: "/apple-icon.png",
	},
	formatDetection: {
		telephone: false,
	},
};

export const viewport: Viewport = {
	themeColor: "#1a1c2c",
	userScalable: false,
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta
					name="apple-mobile-web-app-status-bar-style"
					content="black-translucent"
				/>
				<meta name="apple-mobile-web-app-title" content="PubMon" />
				<link rel="apple-touch-startup-image" href="/apple-icon.png" />
			</head>
			<body
				className={`${pixelFont.variable} ${emeraldFont.variable} font-sans antialiased`}
			>
				{/*<PWADebug />*/}
				<Providers>{children}</Providers>
				<PWAInstaller />
				<Analytics />
			</body>
		</html>
	);
}
