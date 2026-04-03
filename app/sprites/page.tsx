import fs from "fs";
import Image from "next/image";
import path from "path";

export default function SpritesPage() {
	const spritesDir = path.join(process.cwd(), "public/sprites/trainers/front");
	const spriteFiles = fs
		.readdirSync(spritesDir)
		.filter((file) => file.endsWith(".png"))
		.sort();

	return (
		<div className="min-h-screen bg-[#1a1c2c] p-8">
			<h1 className="text-gba-[24] font-pixel text-white mb-4 text-center">
				Trainer Sprites
			</h1>
			<p className="text-sm font-pixel text-white/70 mb-8 text-center">
				{spriteFiles.length} sprites
			</p>

			<div className="flex flex-wrap gap-2 justify-center">
				{spriteFiles.map((file) => {
					const name = file.replace(".png", "");
					const displayName = name
						.split("_")
						.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
						.join(" ");

					return (
						<div key={file} className="flex flex-col items-center gap-2">
							<div className="bg-[#2d3748] p-gba-[32] rounded-lg border-[2gba] border-[#4a5568] hover:border-[#60a5fa] transition-colors">
								<Image
									src={`/sprites/trainers/front/${file}`}
									alt={displayName}
									width={80}
									height={80}
									className="pixelated"
									style={{ imageRendering: "pixelated" }}
									unoptimized
								/>
							</div>
							<p className="text-xs text-white text-center font-pixel break-words max-w-[100px]">
								{displayName}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
