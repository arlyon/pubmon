"use client";

import { useCallback, useEffect, useState } from "react";
import { IconMute } from "./images/IconMute";
import { IconSound } from "./images/IconSound";
import PixelHeader from "./pixel/PixelHeader";
import type { PubMon } from "@/lib/pokemon-data";

const SERVER_URL =
	process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787";

interface OwnedPokeball {
	id: string;
	pubmon: PubMon | null;
	pairedAt: number | null;
}

interface SettingsPanelProps {
	isMuted: boolean;
	onToggleMute: () => void;
	uiScale: number;
	onScaleChange: (scale: number) => void;
	sessionId: string;
	party: PubMon[];
}

function PokeballsSection({
	sessionId,
	party,
}: {
	sessionId: string;
	party: PubMon[];
}) {
	const [balls, setBalls] = useState<OwnedPokeball[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (!sessionId) return;
		try {
			const res = await fetch(
				`${SERVER_URL}/parties/main/rpc/pokeballs/${sessionId}`,
				{ cache: "no-store" },
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { pokeballs: OwnedPokeball[] };
			setBalls(data.pokeballs ?? []);
		} catch {
			setBalls([]);
		} finally {
			setLoading(false);
		}
	}, [sessionId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const assign = useCallback(
		async (ballId: string, partyIndex: number) => {
			setBusyId(ballId);
			try {
				const res = await fetch(
					`${SERVER_URL}/parties/main/rpc/pokeball/${ballId}/assign`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ sessionId, partyIndex }),
					},
				);
				const data = (await res.json()) as {
					success: boolean;
					pokeballs?: OwnedPokeball[];
				};
				if (data.success && data.pokeballs) setBalls(data.pokeballs);
			} finally {
				setBusyId(null);
			}
		},
		[sessionId],
	);

	const unlink = useCallback(
		async (ballId: string) => {
			setBusyId(ballId);
			try {
				const res = await fetch(
					`${SERVER_URL}/parties/main/rpc/pokeball/${ballId}/unlink`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ sessionId }),
					},
				);
				const data = (await res.json()) as {
					success: boolean;
					pokeballs?: OwnedPokeball[];
				};
				if (data.success && data.pokeballs) setBalls(data.pokeballs);
			} finally {
				setBusyId(null);
			}
		},
		[sessionId],
	);

	return (
		<div className="flex flex-col gap-gba-[8] w-full max-w-[260px]">
			<span className="text-gba-[9] font-bold uppercase text-pixel-black">
				Pokéballs
			</span>

			{loading ? (
				<p className="text-gba-[7] text-pixel-gray uppercase">Loading…</p>
			) : balls.length === 0 ? (
				<p className="text-gba-[7] text-pixel-gray uppercase leading-relaxed">
					No Pokéballs paired yet. Scan one to claim it!
				</p>
			) : (
				balls.map((ball) => {
					const currentIndex = ball.pubmon
						? party.findIndex((m) => m.id === ball.pubmon?.id)
						: -1;
					return (
						<div
							key={ball.id}
							className="flex flex-col gap-gba-[4] border-4 border-pixel-black bg-pixel-white p-gba-[8]"
						>
							<span className="text-gba-[7] text-pixel-gray uppercase truncate">
								#{ball.id}
							</span>
							<select
								value={currentIndex}
								disabled={busyId === ball.id || party.length === 0}
								onChange={(e) => assign(ball.id, Number(e.target.value))}
								className="w-full border-2 border-pixel-black bg-pixel-gray-light text-gba-[8] font-bold uppercase text-pixel-black px-gba-[4] py-gba-[2] cursor-pointer"
							>
								{currentIndex === -1 && (
									<option value={-1} disabled>
										{ball.pubmon ? ball.pubmon.name : "EMPTY"}
									</option>
								)}
								{party.map((mon, i) => (
									<option key={`${mon.id}-${i}`} value={i}>
										{mon.name} · LV{mon.level}
									</option>
								))}
							</select>
							<button
								type="button"
								disabled={busyId === ball.id}
								onClick={() => unlink(ball.id)}
								className="self-start px-gba-[8] py-gba-[2] border-2 border-pixel-black bg-pixel-red text-pixel-white text-gba-[7] font-bold uppercase cursor-pointer disabled:opacity-50"
							>
								Unlink / Give Away
							</button>
						</div>
					);
				})
			)}
		</div>
	);
}

export function SettingsPanel({
	isMuted,
	onToggleMute,
	uiScale,
	onScaleChange,
	sessionId,
	party,
}: SettingsPanelProps) {
	return (
		<div className="flex-1 flex flex-col">
			<PixelHeader title="OPTIONS" subtitle="SETTINGS" variant="gray" />
			<div className="flex-1 flex flex-col items-center justify-center gap-gba-[16] p-gba-[16] overflow-y-auto">
			<button
				type="button"
				onClick={onToggleMute}
				className={`flex items-center gap-gba-[8] px-gba-[16] py-gba-[8] border-4 border-pixel-black text-gba-[9] font-bold uppercase transition-colors cursor-pointer ${
					isMuted
						? "bg-pixel-red text-pixel-white"
						: "bg-pixel-white text-pixel-black hover:bg-pixel-gray-light"
				}`}
			>
				{isMuted ? <IconMute /> : <IconSound />}
				{isMuted ? "UNMUTE" : "MUTE"}
			</button>
			<div className="flex flex-col items-center gap-gba-[8] w-full max-w-[200px]">
				<div className="flex justify-between w-full text-gba-[9] font-bold uppercase text-pixel-black">
					<span>UI Scale</span>
					<span>{uiScale.toFixed(2)}x</span>
				</div>
				<input
					type="range"
					min={-1}
					max={1}
					step={0.1}
					value={Math.log2(uiScale)}
					onChange={(e) => onScaleChange(Math.pow(2, Number(e.target.value)))}
					className="w-full cursor-pointer accent-pixel-blue"
				/>
				<div className="flex justify-between w-full text-gba-[7] text-pixel-gray">
					<span>0.5x</span>
					<span>2.0x</span>
				</div>
			</div>
			<PokeballsSection sessionId={sessionId} party={party} />
			</div>
		</div>
	);
}
