"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstaller() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [showInstallPrompt, setShowInstallPrompt] = useState(false);

	useEffect(() => {
		// Register service worker
		// if ("serviceWorker" in navigator) {
		// 	navigator.serviceWorker
		// 		.register("/sw.js")
		// 		.then((registration) => {
		// 			console.log("Service Worker registered:", registration);
		// 		})
		// 		.catch((error) => {
		// 			console.log("Service Worker registration failed:", error);
		// 		});
		// }

		// Listen for install prompt
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);

			// Check if user has dismissed before
			const dismissed = localStorage.getItem("pwa-install-dismissed");
			if (!dismissed) {
				setShowInstallPrompt(true);
			}
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

		// Check if already installed
		if (window.matchMedia("(display-mode: standalone)").matches) {
			setShowInstallPrompt(false);
		}

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
		};
	}, []);

	const handleInstallClick = async () => {
		if (!deferredPrompt) return;

		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === "accepted") {
			console.log("User accepted install");
		} else {
			localStorage.setItem("pwa-install-dismissed", "true");
		}

		setDeferredPrompt(null);
		setShowInstallPrompt(false);
	};

	const handleDismiss = () => {
		localStorage.setItem("pwa-install-dismissed", "true");
		setShowInstallPrompt(false);
	};

	return (
		<AnimatePresence>
			{showInstallPrompt && (
				<motion.div
					initial={{ y: 100, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 100, opacity: 0 }}
					className="fixed bottom-0 left-0 right-0 z-[100] p-4"
					style={{
						paddingBottom: "max(1rem, var(--safe-area-inset-bottom, 0px))",
					}}
				>
					<div
						className="font-sans text-gba-[8] leading-tight"
						style={{
							background: "#2038a0",
							border: "2px solid #101828",
							boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
						}}
					>
						<div
							className="px-4 py-2"
							style={{
								background: "#101828",
								color: "#78b8f0",
								borderBottom: "1px solid #181010",
							}}
						>
							📱 INSTALL PUBMON
						</div>
						<div className="p-4 space-y-3">
							<p style={{ color: "#f8f8f8" }}>
								Add PubMon to your home screen for the full experience!
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={handleInstallClick}
									className="flex-1 py-2 px-4 text-gba-[8] font-heading"
									style={{
										background: "#50b058",
										color: "#f8f8f8",
										border: "2px solid #388840",
										boxShadow: "1px 1px 0 #181010",
									}}
								>
									INSTALL
								</button>
								<button
									type="button"
									onClick={handleDismiss}
									className="flex-1 py-2 px-4 text-gba-[8]"
									style={{
										background: "#182860",
										color: "#a8c8f0",
										border: "2px solid #101828",
										boxShadow: "1px 1px 0 #181010",
									}}
								>
									LATER
								</button>
							</div>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
