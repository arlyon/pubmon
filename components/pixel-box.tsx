"use client";

interface PixelBoxProps {
	children: React.ReactNode;
	className?: string;
	variant?: "default" | "battle" | "menu" | "info";
	style?: React.CSSProperties;
}

export function PixelBox({
	children,
	className = "",
	variant = "default",
	style,
}: PixelBoxProps) {
	const borderColors = {
		default: "border-foreground",
		battle: "border-primary",
		menu: "border-foreground",
		info: "border-accent",
	};

	const bgColors = {
		default: "bg-card",
		battle: "bg-card",
		menu: "bg-background",
		info: "bg-secondary",
	};

	return (
		<div
			className={`
        relative border-2 ${borderColors[variant]} ${bgColors[variant]}
        shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]
        ${className}
      `}
			style={style}
		>
			<div className="relative">{children}</div>
		</div>
	);
}

export function PixelButton({
	children,
	className = "",
	onClick,
	variant = "default",
	disabled = false,
}: {
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
	variant?: "default" | "primary" | "danger" | "type";
	disabled?: boolean;
}) {
	const variants = {
		default:
			"bg-secondary text-secondary-foreground border-foreground hover:bg-accent",
		primary:
			"bg-primary text-primary-foreground border-foreground hover:brightness-110",
		danger:
			"bg-destructive text-destructive-foreground border-foreground hover:brightness-110",
		type: "bg-accent text-accent-foreground border-foreground hover:bg-muted",
	};

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`
        border-2 px-4 py-2 font-sans text-[10px]
        shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)]
        active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]
        active:translate-x-[2px] active:translate-y-[2px]
        transition-all cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${className}
      `}
		>
			{children}
		</button>
	);
}
