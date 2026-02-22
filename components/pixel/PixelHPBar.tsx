import React from "react";

interface PixelHPBarProps {
    current: number;
    max: number;
    label?: string;
}

const PixelHPBar: React.FC<PixelHPBarProps> = ({ current, max, label }) => {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    const color = pct > 50 ? "bg-pixel-hp-green" : pct > 20 ? "bg-pixel-hp-yellow" : "bg-pixel-hp-red";

    return (
        <div className="flex items-center gap-[4px]">
            {label && (
                <span className="font-pixel text-pixel-xs text-pixel-black">{label}</span>
            )}
            <div className="flex-1 h-[4px] bg-pixel-gray-light border border-pixel-black">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="font-pixel text-pixel-xs text-pixel-black">
                {current}/{max}
            </span>
        </div>
    );
};

export default PixelHPBar;
