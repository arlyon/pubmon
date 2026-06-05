import fs from "fs";
import Image from "next/image";
import path from "path";

type SpriteSection = {
	title: string;
	dir: string; // public-relative path, e.g. "pubmon"
	box: number; // render box size in px
};

const SECTIONS: SpriteSection[] = [
	{ title: "PubMon", dir: "pubmon", box: 96 },
	{ title: "Trainers", dir: "pubtrainers", box: 128 },
];

function readSprites(dir: string): string[] {
	const abs = path.join(process.cwd(), "public/sprites", dir);
	if (!fs.existsSync(abs)) return [];
	return fs
		.readdirSync(abs)
		.filter((file) => file.toLowerCase().endsWith(".png"))
		.sort();
}

function displayName(file: string): string {
	return file
		.replace(/\.png$/i, "")
		.replace(/_0*\d+_?$/, "") // strip trailing _00001_ variant tag
		.replace(/_/g, " ")
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SpritesPage() {
	const sections = SECTIONS.map((s) => ({ ...s, files: readSprites(s.dir) }));

	return (
		<div className="h-[100dvh] overflow-y-auto bg-[#1a1c2c] p-8">
			<h1 className="text-gba-[24] text-white mb-8 text-center">
				Sprite Review
			</h1>

			{sections.map((section) => (
				<section key={section.dir} className="mb-12">
					<div className="mb-4 flex items-baseline gap-3 border-b border-[#4a5568] pb-2">
						<h2 className="text-gba-[16] text-white">{section.title}</h2>
						<span className="text-xs text-white/60">
							{section.files.length} sprites · /sprites/{section.dir}
						</span>
					</div>

					<div className="flex flex-wrap gap-3 justify-center">
						{section.files.map((file) => {
							const name = displayName(file);
							return (
								<div
									key={file}
									className="flex flex-col items-center gap-2"
								>
									<div
										className="flex items-center justify-center bg-[#2d3748] p-2 rounded-lg border-2 border-[#4a5568] hover:border-[#60a5fa] transition-colors"
										style={{
											width: section.box + 16,
											height: section.box + 16,
										}}
									>
										<Image
											src={`/sprites/${section.dir}/${file}`}
											alt={name}
											width={section.box}
											height={section.box}
											style={{
												imageRendering: "pixelated",
												objectFit: "contain",
												width: "100%",
												height: "100%",
											}}
											unoptimized
										/>
									</div>
									<p className="text-xs text-white text-center break-words max-w-[110px]">
										{name}
									</p>
								</div>
							);
						})}
					</div>
				</section>
			))}
		</div>
	);
}
