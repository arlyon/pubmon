import React from "react";

interface PixelHeaderProps {
    title: string;
    variant?: "blue" | "red";
}

const PixelHeader: React.FC<PixelHeaderProps> = ({ title, variant = "blue" }) => {
    const bg = variant === "blue" ? "bg-pixel-blue" : "bg-pixel-red";
    const border = variant === "blue" ? "border-pixel-blue-dark" : "border-pixel-red-dark";

    return (
        <div className={`${bg} border-2 ${border} px-[8px] py-[4px]`}>
            <span className="font-pixel text-pixel-sm text-pixel-white">{title}</span>
        </div>
    );
};

export default PixelHeader;
