"use client"
import React, { useState } from "react";
import PixelScreen from "@/components/pixel/PixelScreen";
import MenuDemo from "@/components/demos/MenuDemo";
import PokedexDemo from "@/components/demos/PokedexDemo";
import PartyDemo from "@/components/demos/PartyDemo";
import TextDemo from "@/components/demos/TextDemo";
import BagDemo from "@/components/demos/BagDemo";

const tabs = ["MENU", "PUBDEX", "PARTY", "BAG", "TEXT"];

const demos: Record<string, React.FC> = {
    MENU: MenuDemo,
    "PUBDEX": PokedexDemo,
    PARTY: PartyDemo,
    BAG: BagDemo,
    TEXT: TextDemo,
};

const Demo = () => {
    const [activeTab, setActiveTab] = useState("MENU");
    const DemoComponent = demos[activeTab];

    return (
        <div className="min-h-screen flex flex-col items-center py-[16px] bg-[#101010]">
            <PixelScreen>
                {/* Tab bar */}
                <div className="flex bg-pixel-black">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`font-pixel text-[6px] px-[6px] py-[4px] border-none cursor-pointer ${activeTab === tab
                                    ? "bg-pixel-white text-pixel-black"
                                    : "bg-pixel-blue text-pixel-white"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content area */}
                <div className="bg-[#f8f8f8] min-h-[400px]">
                    <DemoComponent />
                </div>
            </PixelScreen>
        </div>
    );
};

export default Demo;
