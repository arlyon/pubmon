"use client";

interface PixelBoxProps<T extends React.ElementType = "div"> {
	children: React.ReactNode;
	className?: string;
	variant?: "default" | "battle" | "menu" | "info" | "blue" | "red";
	style?: React.CSSProperties;
	as?: T;
}

export function PixelBox<T extends React.ElementType = "div">({
	children,
	className = "",
	variant = "default",
	style,
	as,
	...props
}: PixelBoxProps<T> &
	Omit<React.ComponentPropsWithoutRef<T>, keyof PixelBoxProps<T>>) {
	const Component = as || "div";

	const borderColors = {
		default: "border-foreground",
		battle: "border-primary",
		menu: "border-foreground",
		info: "border-accent",
		blue: "border-pixel-blue-dark",
		red: "border-pixel-red-dark",
	};

	const bgColors = {
		default: "bg-card",
		battle: "bg-card",
		menu: "bg-background",
		info: "bg-secondary",
		blue: "bg-pixel-blue",
		red: "bg-pixel-red",
	};

	return (
		<Component
			className={`
        relative border-gba-[1] ${borderColors[variant]} ${bgColors[variant]}
        shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]
        ${className}
      `}
			style={style}
			{...props}
		>
			<div className="relative">{children}</div>
		</Component>
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
	variant?: "default" | "primary" | "danger" | "type" | "yellow";
	disabled?: boolean;
}) {
	const variants = {
		default: "bg-secondary text-secondary-foreground hover:bg-accent",
		primary: "bg-primary text-primary-foreground hover:brightness-110",
		danger: "bg-destructive text-destructive-foreground hover:brightness-110",
		type: "bg-accent text-accent-foreground hover:bg-muted",
		yellow: "bg-pixel-yellow hover:brightness-110",
	};

	const palettes = {
		default: "font-palette-no-shadow",
		primary: "font-palette-blue",
		danger: "font-palette-red",
		type: "font-palette-blue",
		yellow: "font-palette-default",
	};

	return (
		<PixelBox
			as="button"
			onClick={onClick}
			disabled={disabled}
			className={`
        px-gba-[8] py-gba-[4] font-sans text-gba-[9]
        hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]
        hover:-translate-y-0.5
        transition-all cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${palettes[variant]}
        ${className}
      `}
		>
			{children}
		</PixelBox>
	);
}
