"use client"
import React from "react";
import PixelBox from "../pixel/PixelBox";

const pokedexEntries = [
    { id: 1, name: "BULBASAUR", type: "GRASS", seen: true, caught: true },
    { id: 2, name: "IVYSAUR", type: "GRASS", seen: true, caught: false },
    { id: 3, name: "VENUSAUR", type: "GRASS", seen: false, caught: false },
    { id: 4, name: "CHARMANDER", type: "FIRE", seen: true, caught: true },
    { id: 5, name: "CHARMELEON", type: "FIRE", seen: true, caught: true },
    { id: 6, name: "CHARIZARD", type: "FIRE", seen: true, caught: false },
    { id: 7, name: "SQUIRTLE", type: "WATER", seen: true, caught: true },
    { id: 8, name: "WARTORTLE", type: "WATER", seen: false, caught: false },
    { id: 9, name: "BLASTOISE", type: "WATER", seen: false, caught: false },
    { id: 10, name: "CATERPIE", type: "BUG", seen: true, caught: true },
    { id: 11, name: "METAPOD", type: "BUG", seen: true, caught: false },
    { id: 12, name: "BUTTERFREE", type: "BUG", seen: true, caught: true },
];

const typeColors: Record<string, string> = {
    GRASS: "bg-pixel-green",
    FIRE: "bg-pixel-red",
    WATER: "bg-pixel-blue",
    BUG: "bg-pixel-hp-green",
};

const PokedexDemo: React.FC = () => {
    return (
        <div className="p-[2px]">
            {/* Header */}
            <div className="pixel-box-red mb-[4px]">
                <span className="font-pixel text-pixel-sm text-pixel-white">PUBDEX</span>
            </div>

            {/* Entry list */}
            <PixelBox>
                <div className="pixel-scroll" style={{ maxHeight: 200, overflowY: "auto" }}>
                    {pokedexEntries.map((entry) => (
                        <div
                            key={entry.id}
                            className="flex items-center gap-[4px] py-[3px] border-b border-pixel-gray-light last:border-b-0"
                        >
                            {/* Pokeball icon */}
                            <span className="font-pixel text-pixel-xs w-[10px] text-center">
                                {entry.caught ? "●" : entry.seen ? "○" : " "}
                            </span>
                            {/* Number */}
                            <span className="font-pixel text-pixel-xs text-pixel-black w-[30px]">
                                {String(entry.id).padStart(3, "0")}
                            </span>
                            {/* Name */}
                            <span className="font-pixel text-pixel-xs text-pixel-black flex-1">
                                {entry.seen ? entry.name : "----------"}
                            </span>
                        </div>
                    ))}
                </div>
            </PixelBox>

            {/* Detail panel */}
            <div className="mt-[4px]">
                <PixelBox>
                    <div className="flex gap-[8px]">
                        {/* Sprite placeholder */}
                        <div className="w-[48px] h-[48px] bg-pixel-gray-light border-2 border-pixel-black flex items-center justify-center">
                            <span className="font-pixel text-pixel-xs text-pixel-gray">?</span>
                        </div>
                        <div className="flex-1">
                            <div className="font-pixel text-pixel-sm text-pixel-black mb-[4px]">BULBASAUR</div>
                            <div className="font-pixel text-pixel-xs text-pixel-black mb-[2px]">No. 001</div>
                            <div className="flex gap-[4px] mb-[4px]">
                                <span className={`${typeColors.GRASS || 'bg-gray-500'} font-pixel text-pixel-xs text-pixel-white px-[4px] py-[1px]`}>
                                    GRASS
                                </span>
                            </div>
                            <div className="font-pixel text-pixel-xs text-pixel-black leading-[10px]">
                                SEED PUBMON
                            </div>
                            <div className="font-pixel text-pixel-xs text-pixel-black leading-[10px] mt-[2px]">
                                HT 2'04" WT 15.2 lbs
                            </div>
                        </div>
                    </div>
                </PixelBox>
            </div>

            {/* Stats */}
            <div className="mt-[4px]">
                <PixelBox variant="blue">
                    <span className="font-pixel text-pixel-xs text-pixel-white">SEEN: 8  OWN: 5</span>
                </PixelBox>
            </div>
        </div>
    );
};

export default PokedexDemo;
