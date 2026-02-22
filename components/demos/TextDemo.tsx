"use client"
import React from "react";
import PixelBox from "../pixel/PixelBox";
import PixelTextBox from "../pixel/PixelTextBox";

const TextDemo: React.FC = () => {
    return (
        <div className="p-[2px] space-y-[4px]">
            <div className="pixel-box-blue">
                <span className="font-pixel text-pixel-sm text-pixel-white">TEXT SAMPLES</span>
            </div>

            <PixelTextBox text="OAK: Hello there! Welcome to the world of PUBMON!" />

            <PixelTextBox text="My name is OAK! People call me the PUBMON PROF!" showContinue />

            <PixelTextBox
                text="This world is inhabited by creatures called PUBMON! For some people, PUBMON are pets. Others use them for fights."
                showContinue
            />

            {/* Sign post style */}
            <PixelBox>
                <div className="text-center">
                    <div className="font-pixel text-pixel-xs text-pixel-black mb-[4px]">── PALLET TOWN ──</div>
                    <div className="font-pixel text-pixel-xs text-pixel-black leading-[12px]">
                        Shades of your journey await!
                    </div>
                </div>
            </PixelBox>

            {/* Item description style */}
            <PixelBox variant="blue">
                <div className="font-pixel text-pixel-xs text-pixel-white mb-[2px]">POTION</div>
                <div className="font-pixel text-[6px] text-pixel-white leading-[10px]">
                    Restores the HP of one PUBMON by 20 points.
                </div>
            </PixelBox>

            {/* Yes/No dialog */}
            <div className="flex gap-[4px]">
                <div className="flex-1">
                    <PixelTextBox text="Would you like to save the game?" showContinue={false} />
                </div>
                <div style={{ width: 60 }}>
                    <PixelBox>
                        <div className="relative pl-[14px] font-pixel text-pixel-xs text-pixel-black py-[2px] pixel-cursor">YES</div>
                        <div className="pl-[14px] font-pixel text-pixel-xs text-pixel-black py-[2px]">NO</div>
                    </PixelBox>
                </div>
            </div>

            <PixelTextBox text="RED saved the game!" showContinue={false} />
        </div>
    );
};

export default TextDemo;
