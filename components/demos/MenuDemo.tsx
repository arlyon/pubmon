"use client"
import React from "react";
import PixelMenu from "../pixel/PixelMenu";
import PixelTextBox from "../pixel/PixelTextBox";
import PixelBox from "../pixel/PixelBox";

const MenuDemo: React.FC = () => {
    return (
        <div className="p-[2px]">
            {/* Title bar */}
            <div className="pixel-box-blue mb-[4px]">
                <span className="font-pixel text-pixel-sm text-pixel-white">MENU</span>
            </div>

            {/* Main menu */}
            <div className="flex gap-[4px]">
                <div className="flex-1">
                    {/* Trainer card area */}
                    <PixelBox>
                        <div className="flex items-center gap-[8px] mb-[6px]">
                            <div className="w-[32px] h-[32px] bg-pixel-blue border-2 border-pixel-black flex items-center justify-center">
                                <span className="font-pixel text-pixel-xs text-pixel-white">♂</span>
                            </div>
                            <div>
                                <div className="font-pixel text-pixel-sm text-pixel-black">RED</div>
                                <div className="font-pixel text-pixel-xs text-pixel-gray mt-[2px]">BADGES: 3</div>
                            </div>
                        </div>
                        <div className="font-pixel text-pixel-xs text-pixel-black">
                            MONEY: ¥12500
                        </div>
                        <div className="font-pixel text-pixel-xs text-pixel-black mt-[2px]">
                            TIME: 12:34
                        </div>
                    </PixelBox>
                </div>

                {/* Menu options */}
                <div style={{ width: 120 }}>
                    <PixelMenu
                        items={["PUBDEX", "PUBMON", "BAG", "RED", "SAVE", "OPTION", "EXIT"]}
                    />
                </div>
            </div>

            {/* Dialog */}
            <div className="mt-[4px]">
                <PixelTextBox text="What would you like to do?" />
            </div>
        </div>
    );
};

export default MenuDemo;
