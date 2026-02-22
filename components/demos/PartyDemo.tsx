"use client"
import React from "react";
import PixelBox from "../pixel/PixelBox";
import PixelHPBar from "../pixel/PixelHPBar";
import PixelMenu from "../pixel/PixelMenu";

const party = [
    { name: "CHARIZARD", level: 45, hp: 142, maxHp: 142, type: "FIRE" },
    { name: "PIKACHU", level: 38, hp: 89, maxHp: 95, type: "ELEC" },
    { name: "LAPRAS", level: 35, hp: 12, maxHp: 155, type: "WATER" },
    { name: "SNORLAX", level: 40, hp: 210, maxHp: 210, type: "NORMAL" },
    { name: "ALAKAZAM", level: 36, hp: 0, maxHp: 98, type: "PSYCHC" },
    { name: "JOLTEON", level: 33, hp: 78, maxHp: 105, type: "ELEC" },
];

const PartyDemo: React.FC = () => {
    return (
        <div className="p-[2px]">
            <div className="pixel-box-blue mb-[4px]">
                <span className="font-pixel text-pixel-sm text-pixel-white">PUBMON</span>
            </div>

            <div className="space-y-[3px]">
                {party.map((mon, i) => (
                    <PixelBox key={i}>
                        <div className="flex items-center gap-[6px]">
                            {/* Sprite placeholder */}
                            <div className="w-[24px] h-[24px] bg-pixel-gray-light border border-pixel-black flex items-center justify-center shrink-0">
                                <span className="font-pixel text-[6px] text-pixel-gray">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-[2px]">
                                    <span className="font-pixel text-pixel-xs text-pixel-black">{mon.name}</span>
                                    <span className="font-pixel text-pixel-xs text-pixel-black">Lv{mon.level}</span>
                                </div>
                                <PixelHPBar current={mon.hp} max={mon.maxHp} label="HP" />
                            </div>
                        </div>
                    </PixelBox>
                ))}
            </div>

            {/* Action menu at bottom */}
            <div className="mt-[4px] flex justify-end">
                <div style={{ width: 100 }}>
                    <PixelMenu items={["SUMMARY", "SWITCH", "CANCEL"]} />
                </div>
            </div>
        </div>
    );
};

export default PartyDemo;
