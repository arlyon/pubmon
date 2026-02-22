"use client";

import type React from "react";
import { useEffect, useState } from "react";
import PixelBox from "@/components/pixel/PixelBox";
import PixelHPBar from "@/components/pixel/PixelHPBar";

interface BattlePokemon {
	name: string;
	level: number;
	hp: number;
	maxHp: number;
}

interface BattleSceneProps {
	/** Whether the slide-in animation should play */
	animateIn: boolean;
	onReady?: () => void;
}

const playerMon: BattlePokemon = {
	name: "CHARIZARD",
	level: 45,
	hp: 142,
	maxHp: 142,
};

const enemyMon: BattlePokemon = {
	name: "BLASTOISE",
	level: 44,
	hp: 155,
	maxHp: 155,
};

const SLIDE_FRAMES = 16;
const FRAME_MS = 30;

const BattleScene: React.FC<BattleSceneProps> = ({ animateIn, onReady }) => {
	// 0 = fully off-screen, SLIDE_FRAMES = fully in place
	const [slideFrame, setSlideFrame] = useState(0);
	const [showMenu, setShowMenu] = useState(false);

	useEffect(() => {
		if (!animateIn) return;

		// Reset animation state
		setSlideFrame(0);
		setShowMenu(false);

		let frame = 0;
		let lastTime = performance.now();
		let animationId: number;

		const animate = (currentTime: number) => {
			const elapsed = currentTime - lastTime;

			if (elapsed >= FRAME_MS) {
				frame++;
				setSlideFrame(frame);
				lastTime = currentTime;

				if (frame >= SLIDE_FRAMES) {
					// Animation complete, show menu
					setTimeout(() => {
						setShowMenu(true);
						onReady?.();
					}, 200);
					return;
				}
			}

			animationId = requestAnimationFrame(animate);
		};

		animationId = requestAnimationFrame(animate);

		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	}, [animateIn, onReady]);

	// Calculate pixel offsets (snap to grid of 2px)
	const progress = Math.min(slideFrame / SLIDE_FRAMES, 1);
	// Ease-out: decelerate as it approaches
	const eased = 1 - (1 - progress) ** 2;
	const playerOffset = Math.round(((1 - eased) * 160) / 2) * 2; // snapped to 2px
	const enemyOffset = Math.round(((1 - eased) * 160) / 2) * 2;

	return (
		<div className="relative" style={{ minHeight: 200 }}>
			{/* Battle background */}
			<div
				className="bg-pixel-white"
				style={{ height: 120, position: "relative", overflow: "hidden" }}
			>
				{/* Ground lines */}
				<div
					className="absolute bottom-0 left-0 right-0"
					style={{
						height: 40,
						background: "rgb(var(--pixel-green))",
						borderTop: "2px solid rgb(var(--pixel-black))",
					}}
				/>

				{/* Enemy platform */}
				<div
					className="absolute"
					style={{
						top: 28,
						right: -enemyOffset,
						transition: "none",
					}}
				>
					{/* Platform */}
					<div
						className="bg-pixel-gray"
						style={{
							width: 80,
							height: 8,
							borderRadius: "50%",
							marginLeft: 20,
							border: "2px solid rgb(var(--pixel-black))",
						}}
					/>
					{/* Enemy sprite placeholder */}
					<div
						className="flex items-center justify-center bg-pixel-blue"
						style={{
							width: 40,
							height: 40,
							position: "absolute",
							bottom: 6,
							left: 40,
							border: "2px solid rgb(var(--pixel-black))",
						}}
					>
						<span className="font-pixel text-[6px] text-pixel-white leading-[8px] text-center">
							{enemyMon.name.slice(0, 4)}
						</span>
					</div>
				</div>

				{/* Player platform */}
				<div
					className="absolute"
					style={{
						bottom: 6,
						left: -playerOffset,
						transition: "none",
					}}
				>
					{/* Platform */}
					<div
						className="bg-pixel-gray"
						style={{
							width: 80,
							height: 8,
							borderRadius: "50%",
							border: "2px solid rgb(var(--pixel-black))",
						}}
					/>
					{/* Player sprite placeholder */}
					<div
						className="flex items-center justify-center bg-pixel-red"
						style={{
							width: 48,
							height: 48,
							position: "absolute",
							bottom: 4,
							left: 16,
							border: "2px solid rgb(var(--pixel-black))",
						}}
					>
						<span className="font-pixel text-[6px] text-pixel-white leading-[8px] text-center">
							{playerMon.name.slice(0, 4)}
						</span>
					</div>
				</div>

				{/* Enemy info box */}
				{slideFrame >= SLIDE_FRAMES && (
					<div className="absolute top-[4px] left-[4px]" style={{ width: 140 }}>
						<PixelBox>
							<div className="flex justify-between mb-[2px]">
								<span className="font-pixel text-[6px] text-pixel-black">
									{enemyMon.name}
								</span>
								<span className="font-pixel text-[5px] text-pixel-black">
									Lv{enemyMon.level}
								</span>
							</div>
							<PixelHPBar current={enemyMon.hp} max={enemyMon.maxHp} />
						</PixelBox>
					</div>
				)}

				{/* Player info box */}
				{slideFrame >= SLIDE_FRAMES && (
					<div
						className="absolute bottom-[42px] right-[4px]"
						style={{ width: 148 }}
					>
						<PixelBox>
							<div className="flex justify-between mb-[2px]">
								<span className="font-pixel text-[6px] text-pixel-black">
									{playerMon.name}
								</span>
								<span className="font-pixel text-[5px] text-pixel-black">
									Lv{playerMon.level}
								</span>
							</div>
							<PixelHPBar
								current={playerMon.hp}
								max={playerMon.maxHp}
								label="HP"
							/>
						</PixelBox>
					</div>
				)}
			</div>

			{/* Battle menu */}
			{showMenu && (
				<div>
					<PixelBox>
						<div className="font-pixel text-[6px] text-pixel-black leading-[12px] mb-[4px]">
							What will {playerMon.name} do?
						</div>
					</PixelBox>
					<div className="grid grid-cols-2 gap-[2px] mt-[2px]">
						{["FIGHT", "BAG", "POKéMON", "RUN"].map((action) => (
							<button
								key={action}
								className="pixel-box cursor-pointer font-pixel text-[6px] text-pixel-black text-center py-[6px] border-none"
								style={{
									background: "rgb(var(--pixel-white))",
									border: "2px solid rgb(var(--pixel-black))",
								}}
							>
								{action}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default BattleScene;
