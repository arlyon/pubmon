"use client";

import { IconMute } from "./images/IconMute";
import { IconSound } from "./images/IconSound";
import PixelHeader from "./pixel/PixelHeader";

interface SettingsPanelProps {
	isMuted: boolean;
	onToggleMute: () => void;
	uiScale: number;
	onScaleChange: (scale: number) => void;
}

export function SettingsPanel({ isMuted, onToggleMute, uiScale, onScaleChange }: SettingsPanelProps) {
	return (
		<div className="flex-1 flex flex-col">
			<PixelHeader title="OPTIONS" subtitle="SETTINGS" variant="gray" />
			<div className="flex-1 flex flex-col items-center justify-center gap-gba-[16] p-gba-[16]">
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
			</div>
		</div>
	);
}
