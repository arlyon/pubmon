"use client";

import { useState } from "react";
import { GYMS } from "@/lib/gym-data";
import { PixelBox } from "./pixel-box";

interface DebugPanelProps {
	state: any;
	context: any;
}

export function DebugPanel({ state, context }: DebugPanelProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [selectedTab, setSelectedTab] = useState<"state" | "context">(
		"context",
	);

	const handleLogout = () => {
		// Delete the session cookie
		document.cookie =
			"pubmon_session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
		// Reload the page to reset state
		window.location.reload();
	};

	// Only show in development
	if (process.env.NODE_ENV !== "development") {
		return null;
	}

	return (
		<div className="fixed bottom-3 right-3 z-[9999] max-w-md pointer-events-none">
			{isExpanded ? (
				<PixelBox className="m-4 max-h-[80vh] overflow-hidden flex flex-col">
					{/* Header */}
					<div className="flex items-center justify-between p-2 border-b border-border bg-muted/50">
						<div className="flex gap-2">
							<button
								onClick={() => setSelectedTab("context")}
								className={`text-[8px] px-2 py-1 font-mono ${
									selectedTab === "context"
										? "bg-primary text-primary-foreground"
										: "bg-muted hover:bg-muted/80"
								}`}
							>
								CONTEXT
							</button>
							<button
								onClick={() => setSelectedTab("state")}
								className={`text-[8px] px-2 py-1 font-mono ${
									selectedTab === "state"
										? "bg-primary text-primary-foreground"
										: "bg-muted hover:bg-muted/80"
								}`}
							>
								STATE
							</button>
						</div>
						<div className="flex gap-2">
							<button
								onClick={handleLogout}
								className="text-[8px] px-2 py-1 bg-destructive text-destructive-foreground hover:bg-destructive/80 font-mono"
							>
								LOGOUT
							</button>
							<button
								onClick={() => setIsExpanded(false)}
								className="text-[8px] px-2 py-1 hover:bg-destructive/10 font-mono"
							>
								✕
							</button>
						</div>
					</div>

					{/* Content */}
					<div className="overflow-auto p-2 text-[8px] font-mono flex-1">
						{selectedTab === "context" ? (
							<div className="space-y-2">
								<div className="grid grid-cols-2 gap-2">
									<div className="text-muted-foreground">Phase:</div>
									<div className="font-bold text-primary">
										{context.gamePhase}
									</div>

									<div className="text-muted-foreground">Current Gym:</div>
									<div className="font-bold">{context.currentGymId}</div>

									<div className="text-muted-foreground">Player:</div>
									<div className="font-bold truncate">
										{context.playerInfo?.name || "N/A"}
									</div>

									<div className="text-muted-foreground">Session:</div>
									<div className="font-bold truncate text-[6px]">
										{context.sessionId || "N/A"}
									</div>

									<div className="text-muted-foreground">Party:</div>
									<div className="font-bold">
										{context.party?.length || 0} PubMon
									</div>

									<div className="text-muted-foreground">Badges:</div>
									<div className="font-bold">
										{context.badges?.size || 0}/{GYMS.length}
									</div>

									<div className="text-muted-foreground">Tournament:</div>
									<div className="font-bold">
										{context.tournamentState?.isOptedIn
											? "✓ Opted In"
											: "✗ Not Opted"}
									</div>

									<div className="text-muted-foreground col-span-2 mt-2 border-t border-border pt-2">
										Active Battle Info:
									</div>

									<div className="text-muted-foreground">Battle ID:</div>
									<div className="font-bold text-[6px] truncate">
										{context.tournamentState?.activeBattle?.battleId || "None"}
									</div>

									<div className="text-muted-foreground">Opponent:</div>
									<div className="font-bold">
										{context.tournamentState?.activeBattle?.opponentName ||
											"N/A"}
									</div>
								</div>

								<details className="mt-4">
									<summary className="cursor-pointer text-primary hover:underline">
										Full Context JSON
									</summary>
									<pre className="mt-2 p-2 bg-muted/50 rounded overflow-auto max-h-60 text-[6px]">
										{JSON.stringify(
											{
												...context,
												badges: Array.from(context.badges || []),
											},
											null,
											2,
										)}
									</pre>
								</details>
							</div>
						) : (
							<div>
								<div className="mb-2">
									<span className="text-muted-foreground">Current State: </span>
									<span className="font-bold text-primary">
										{typeof state.value === "string"
											? state.value
											: JSON.stringify(state.value)}
									</span>
								</div>
								<div className="space-y-1 mb-2">
									<div className="text-muted-foreground">Matches:</div>
									{state.matches && typeof state.matches === "object" && (
										<ul className="ml-2">
											{Object.entries(state.matches).map(([key, value]) => (
												<li key={key} className="text-[7px]">
													{key}: {String(value)}
												</li>
											))}
										</ul>
									)}
								</div>
								<details>
									<summary className="cursor-pointer text-primary hover:underline">
										Full State JSON
									</summary>
									<pre className="mt-2 p-2 bg-muted/50 rounded overflow-auto max-h-60 text-[6px]">
										{JSON.stringify(
											{
												value: state.value,
												context: state.context,
												matches: state.matches,
												can: state.can ? "function" : undefined,
												hasTag: state.hasTag ? "function" : undefined,
											},
											(key, value) => {
												// Convert functions to strings
												if (typeof value === "function") {
													return "[Function]";
												}
												// Convert Sets to Arrays
												if (value instanceof Set) {
													return Array.from(value);
												}
												return value;
											},
											2,
										)}
									</pre>
								</details>
							</div>
						)}
					</div>
				</PixelBox>
			) : (
				<button
					onClick={() => setIsExpanded(true)}
					className="px-3 py-2 bg-primary text-primary-foreground text-[10px] font-mono hover:opacity-80 border-2 border-primary-foreground/20"
					style={{ fontFamily: "'Press Start 2P', monospace" }}
				>
					DEBUG
				</button>
			)}
		</div>
	);
}
