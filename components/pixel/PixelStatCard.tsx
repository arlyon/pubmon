import type { PubMon } from "@/lib/pokemon-data";
import { TypeBadge } from "../pixel-sprite";
import PixelBox from "./PixelBox";
import PixelHPBar from "./PixelHPBar";

const STATUS_COLORS: Record<
	string,
	{ bg: string; text: string; label: string }
> = {
	brn: { bg: "#e43b44", text: "#fff", label: "BRN" },
	psn: { bg: "#a86dd9", text: "#fff", label: "PSN" },
	tox: { bg: "#a86dd9", text: "#fff", label: "TOX" },
	par: { bg: "#ffd500", text: "#1a1c2c", label: "PAR" },
	slp: { bg: "#6e7a8a", text: "#fff", label: "SLP" },
	frz: { bg: "#00c2ff", text: "#1a1c2c", label: "FRZ" },
};

function StatusBadge({ status }: { status: string | null }) {
	if (!status) return null;
	const statusInfo = STATUS_COLORS[status.toLowerCase()];
	if (!statusInfo) return null;

	return (
		<span
			className="font-pixel text-gba-[9] px-1 py-0.5 rounded-sm"
			style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
		>
			{statusInfo.label}
		</span>
	);
}

interface PixelStatCardProps {
	pokemon: PubMon;
	currentHp: number;
	maxHp?: number; // Optional override for battle-calculated max HP
	status?: string | null;
	showHpLabel?: boolean;
	showHpNumbers?: boolean; // Whether to show exact HP numbers
}

export default function PixelStatCard({
	pokemon,
	currentHp,
	maxHp,
	status,
	showHpLabel = false,
	showHpNumbers = true,
}: PixelStatCardProps) {
	const actualMaxHp = maxHp ?? pokemon.maxHp;

	return (
		<PixelBox className="bg-transparent">
			<div className="flex items-center gap-1 mb-1">
				<span className="font-pixel text-gba-[9] text-pixel-black">
					{pokemon.name.toUpperCase()}
				</span>
				<TypeBadge type={pokemon.type} />
				{status && <StatusBadge status={status} />}
			</div>
			<span className="font-pixel text-gba-[9] text-pixel-black block mb-1">
				Lv{pokemon.level}
			</span>
			<PixelHPBar
				current={currentHp}
				max={actualMaxHp}
				label={showHpLabel ? "HP" : undefined}
				showNumbers={showHpNumbers}
			/>
		</PixelBox>
	);
}
