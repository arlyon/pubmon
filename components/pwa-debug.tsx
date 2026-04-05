"use client";

import { useEffect, useState } from "react";

export function PWADebug() {
	const [debug, setDebug] = useState<{
		isStandalone: boolean;
		hasServiceWorker: boolean;
		manifestUrl: string | null;
		isSecure: boolean;
		userAgent: string;
		canInstall: boolean;
	} | null>(null);

	useEffect(() => {
		const isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			(window.navigator as any).standalone === true;

		const hasServiceWorker = "serviceWorker" in navigator;
		const isSecure = window.location.protocol === "https:" || window.location.hostname === "localhost";

		// Check for manifest
		const manifestLink = document.querySelector('link[rel="manifest"]');
		const manifestUrl = manifestLink?.getAttribute("href") || null;

		setDebug({
			isStandalone,
			hasServiceWorker,
			manifestUrl,
			isSecure,
			userAgent: navigator.userAgent,
			canInstall: false,
		});

		// Listen for install prompt
		const handler = (e: Event) => {
			console.log("beforeinstallprompt event fired!", e);
			setDebug((prev) => (prev ? { ...prev, canInstall: true } : null));
		};

		window.addEventListener("beforeinstallprompt", handler);

		return () => {
			window.removeEventListener("beforeinstallprompt", handler);
		};
	}, []);

	if (!debug) return null;

	// Only show if there's an issue or in development
	const hasIssue = !debug.isSecure || !debug.hasServiceWorker || !debug.manifestUrl;

	if (!hasIssue && process.env.NODE_ENV === "production") return null;

	return (
		<div className="fixed top-0 left-0 right-0 z-[999] p-2 bg-yellow-500 text-black text-xs overflow-auto max-h-[200px]">
			<div className="font-bold mb-2">🔧 PWA Debug Info</div>
			<div className="space-y-1 font-mono text-[10px]">
				<div>
					✓ Standalone: {debug.isStandalone ? "Yes (Already installed)" : "No"}
				</div>
				<div>
					{debug.hasServiceWorker ? "✓" : "✗"} Service Worker Support:{" "}
					{debug.hasServiceWorker ? "Yes" : "No"}
				</div>
				<div>
					{debug.manifestUrl ? "✓" : "✗"} Manifest:{" "}
					{debug.manifestUrl || "Not found"}
				</div>
				<div>
					{debug.isSecure ? "✓" : "✗"} Secure Context:{" "}
					{debug.isSecure ? "Yes" : "No (HTTPS required for PWA)"}
				</div>
				<div>
					{debug.canInstall ? "✓" : "⚠"} Install Prompt:{" "}
					{debug.canInstall ? "Available" : "Not triggered yet"}
				</div>
				<div className="mt-2 text-[9px] opacity-75">
					UA: {debug.userAgent.substring(0, 80)}...
				</div>
			</div>
		</div>
	);
}
