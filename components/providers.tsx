"use client";

import { AudioProvider } from "./audio-manager";

export function Providers({ children }: { children: React.ReactNode }) {
	return <AudioProvider>{children}</AudioProvider>;
}
