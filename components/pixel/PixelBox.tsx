import React from "react";

interface PixelBoxProps {
  children: React.ReactNode;
  variant?: "default" | "blue" | "red";
  className?: string;
  style?: React.CSSProperties;
}

const PixelBox: React.FC<PixelBoxProps> = ({ children, variant = "default", className = "", style }) => {
  const variantClass = variant === "blue"
    ? "pixel-box-blue"
    : variant === "red"
      ? "pixel-box-red"
      : "pixel-box";

  return (
    <div className={`${variantClass} ${className}`} style={style}>
      {children}
    </div>
  );
};

export default PixelBox;
