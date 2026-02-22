"use client"
import React from "react";
import PixelBox from "../pixel/PixelBox";
import PixelMenu from "../pixel/PixelMenu";

const items = [
    { name: "POTION", count: 12, pocket: "ITEMS" },
    { name: "SUPER POTION", count: 3, pocket: "ITEMS" },
    { name: "ANTIDOTE", count: 5, pocket: "ITEMS" },
    { name: "PARALYZE HEAL", count: 2, pocket: "ITEMS" },
    { name: "REPEL", count: 7, pocket: "ITEMS" },
    { name: "ESCAPE ROPE", count: 1, pocket: "ITEMS" },
    { name: "POKé BALL", count: 24, pocket: "BALLS" },
    { name: "GREAT BALL", count: 8, pocket: "BALLS" },
];

const BagDemo: React.FC = () => {
    return (
        <div className="p-[2px]">
            <div className="pixel-box-blue mb-[4px]">
                <span className="font-pixel text-pixel-sm text-pixel-white">BAG</span>
            </div>

            {/* Pocket tabs */}
            <div className="flex mb-[3px]">
                {["ITEMS", "BALLS", "TMs", "KEY"].map((tab, i) => (
                    <div
                        key={tab}
                        className={`font-pixel text-[6px] px-[6px] py-[3px] border border-pixel-black ${i === 0
                                ? "bg-pixel-white text-pixel-black border-b-0"
                                : "bg-pixel-gray-light text-pixel-gray"
                            }`}
                    >
                        {tab}
                    </div>
                ))}
            </div>

            {/* Item list */}
            <PixelBox>
                {items
                    .filter((it) => it.pocket === "ITEMS")
                    .map((item, i) => (
                        <div
                            key={i}
                            className={`flex justify-between items-center py-[3px] px-[2px] ${i === 0 ? "bg-pixel-gray-light" : ""
                                }`}
                        >
                            <span className="font-pixel text-pixel-xs text-pixel-black">{item.name}</span>
                            <span className="font-pixel text-pixel-xs text-pixel-black">x{item.count}</span>
                        </div>
                    ))}
            </PixelBox>

            {/* Item description */}
            <div className="mt-[4px]">
                <PixelBox variant="blue">
                    <div className="font-pixel text-[6px] text-pixel-white leading-[10px]">
                        Restores the HP of one PUBMON by 20 points.
                    </div>
                </PixelBox>
            </div>

            {/* Action */}
            <div className="mt-[4px] flex justify-end">
                <div style={{ width: 80 }}>
                    <PixelMenu items={["USE", "TOSS", "CANCEL"]} />
                </div>
            </div>
        </div>
    );
};

export default BagDemo;
