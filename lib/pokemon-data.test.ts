import { expect, test, describe } from "bun:test";
import {
	ALL_PUBMON,
	MOVE_MAPPINGS,
	TYPE_INFO,
	PUBMON_TYPE_MAP,
	getBaseMoveForAudio,
	getPubMonSprite,
	getMissingnoSprite,
	getRandomPubMon,
	generatePubMonModData,
	type PubMon,
	type PubType,
} from "./pokemon-data";

const ALL_TYPES: PubType[] = ["beer", "shot", "wine", "water", "cocktail"];

// ==========================================
// 1. ALL_PUBMON Data Integrity
// ==========================================
describe("ALL_PUBMON Data Integrity", () => {
	test("ALL_PUBMON is a non-empty array", () => {
		expect(Array.isArray(ALL_PUBMON)).toBe(true);
		expect(ALL_PUBMON.length).toBeGreaterThan(0);
	});

	test("every PubMon has required fields", () => {
		for (const mon of ALL_PUBMON) {
			expect(mon.id).toBeDefined();
			expect(mon.name).toBeDefined();
			expect(mon.type).toBeDefined();
			expect(mon.hp).toBeDefined();
			expect(mon.maxHp).toBeDefined();
			expect(mon.level).toBeDefined();
			expect(mon.attack).toBeDefined();
			expect(mon.defense).toBeDefined();
			expect(mon.moves).toBeDefined();
			expect(mon.sprite).toBeDefined();
			expect(mon.description).toBeDefined();
			expect(mon.cry).toBeDefined();
			expect(mon.visuals).toBeDefined();
		}
	});

	test("every PubMon has a unique id", () => {
		const ids = ALL_PUBMON.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test("every PubMon has a unique name", () => {
		const names = ALL_PUBMON.map((m) => m.name);
		expect(new Set(names).size).toBe(names.length);
	});

	test("every PubMon type is one of beer, shot, wine, water, cocktail", () => {
		for (const mon of ALL_PUBMON) {
			expect(ALL_TYPES).toContain(mon.type);
		}
	});

	test("every PubMon has at least 1 and at most 4 moves", () => {
		for (const mon of ALL_PUBMON) {
			expect(mon.moves.length).toBeGreaterThanOrEqual(1);
			expect(mon.moves.length).toBeLessThanOrEqual(4);
		}
	});

	test("the vast majority of PubMon moves exist in MOVE_MAPPINGS", () => {
		const missing: string[] = [];
		let total = 0;
		for (const mon of ALL_PUBMON) {
			for (const move of mon.moves) {
				total++;
				const moveId = move.toLowerCase().replace(/[^a-z0-9]+/g, "");
				if (!MOVE_MAPPINGS[moveId]) {
					missing.push(`${mon.name}: ${move}`);
				}
			}
		}
		// Allow a small number of unmapped moves (they fall back to "tackle" in generatePubMonModData)
		// but flag if more than 10% are missing
		expect(missing.length).toBeLessThan(total * 0.1);
	});

	test("known mapped moves resolve correctly", () => {
		// Spot-check moves we know are mapped from each type
		const knownMappings: [string, string][] = [
			["grainslam", "tackle"],
			["greenflame", "flamethrower"],
			["oakcharm", "tailwhip"],
			["springgush", "hydropump"],
			["olivetoss", "rockthrow"],
		];
		for (const [moveId, baseMove] of knownMappings) {
			expect(MOVE_MAPPINGS[moveId]).toBe(baseMove);
		}
	});

	test("every PubMon has hp > 0 and maxHp > 0", () => {
		for (const mon of ALL_PUBMON) {
			expect(mon.hp).toBeGreaterThan(0);
			expect(mon.maxHp).toBeGreaterThan(0);
		}
	});

	test("every PubMon has level > 0", () => {
		for (const mon of ALL_PUBMON) {
			expect(mon.level).toBeGreaterThan(0);
		}
	});

	test("every PubMon has attack > 0 and defense > 0", () => {
		for (const mon of ALL_PUBMON) {
			expect(mon.attack).toBeGreaterThan(0);
			expect(mon.defense).toBeGreaterThan(0);
		}
	});

	test("cry values are all positive numbers", () => {
		for (const mon of ALL_PUBMON) {
			expect(typeof mon.cry).toBe("number");
			expect(mon.cry).toBeGreaterThan(0);
		}
	});

	test("there are PubMon of each type", () => {
		for (const type of ALL_TYPES) {
			const count = ALL_PUBMON.filter((m) => m.type === type).length;
			expect(count).toBeGreaterThan(0);
		}
	});
});

// ==========================================
// 2. MOVE_MAPPINGS
// ==========================================
describe("MOVE_MAPPINGS", () => {
	test("MOVE_MAPPINGS is a non-empty object", () => {
		expect(typeof MOVE_MAPPINGS).toBe("object");
		expect(Object.keys(MOVE_MAPPINGS).length).toBeGreaterThan(0);
	});

	test("every mapping value is a string", () => {
		for (const [key, value] of Object.entries(MOVE_MAPPINGS)) {
			expect(typeof value).toBe("string");
		}
	});

	test("every mapping value is lowercase with no spaces", () => {
		for (const [key, value] of Object.entries(MOVE_MAPPINGS)) {
			expect(value).toBe(value.toLowerCase());
			expect(value).not.toContain(" ");
		}
	});

	test("no duplicate custom move names", () => {
		const keys = Object.keys(MOVE_MAPPINGS);
		expect(new Set(keys).size).toBe(keys.length);
	});

	test("contains expected mappings", () => {
		expect(MOVE_MAPPINGS["grainslam"]).toBe("tackle");
		expect(MOVE_MAPPINGS["greenflame"]).toBe("flamethrower");
		expect(MOVE_MAPPINGS["springgush"]).toBe("hydropump");
		expect(MOVE_MAPPINGS["olivetoss"]).toBe("rockthrow");
		expect(MOVE_MAPPINGS["oakcharm"]).toBe("tailwhip");
	});
});

// ==========================================
// 3. TYPE_INFO
// ==========================================
describe("TYPE_INFO", () => {
	test("has entries for all 5 types", () => {
		for (const type of ALL_TYPES) {
			expect(TYPE_INFO[type]).toBeDefined();
		}
	});

	test("each entry has label, element, color, bgColor", () => {
		for (const type of ALL_TYPES) {
			const info = TYPE_INFO[type];
			expect(info.label).toBeDefined();
			expect(info.element).toBeDefined();
			expect(info.color).toBeDefined();
			expect(info.bgColor).toBeDefined();
		}
	});

	test("colors are valid hex color strings", () => {
		for (const type of ALL_TYPES) {
			const info = TYPE_INFO[type];
			expect(info.color).toMatch(/^#[0-9a-fA-F]{6}$/);
			expect(info.bgColor).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});

	test("labels match expected values", () => {
		expect(TYPE_INFO.beer.label).toBe("Beer");
		expect(TYPE_INFO.shot.label).toBe("Shot");
		expect(TYPE_INFO.wine.label).toBe("Wine");
		expect(TYPE_INFO.water.label).toBe("Water");
		expect(TYPE_INFO.cocktail.label).toBe("Cocktail");
	});
});

// ==========================================
// 4. PUBMON_TYPE_MAP
// ==========================================
describe("PUBMON_TYPE_MAP", () => {
	test("maps all 5 PubTypes to Pokemon types", () => {
		for (const type of ALL_TYPES) {
			expect(PUBMON_TYPE_MAP[type]).toBeDefined();
		}
	});

	test("beer maps to Ground", () => {
		expect(PUBMON_TYPE_MAP.beer).toBe("Ground");
	});

	test("shot maps to Fire", () => {
		expect(PUBMON_TYPE_MAP.shot).toBe("Fire");
	});

	test("wine maps to Poison", () => {
		expect(PUBMON_TYPE_MAP.wine).toBe("Poison");
	});

	test("water maps to Water", () => {
		expect(PUBMON_TYPE_MAP.water).toBe("Water");
	});

	test("cocktail maps to Grass", () => {
		expect(PUBMON_TYPE_MAP.cocktail).toBe("Grass");
	});
});

// ==========================================
// 5. getBaseMoveForAudio
// ==========================================
describe("getBaseMoveForAudio", () => {
	test("returns base move for known custom moves", () => {
		expect(getBaseMoveForAudio("grainslam")).toBe("tackle");
	});

	test("returns base move for uppercase input", () => {
		expect(getBaseMoveForAudio("GrainSlam")).toBe("tackle");
	});

	test("returns base move for mixed case input", () => {
		expect(getBaseMoveForAudio("GreenFlame")).toBe("flamethrower");
	});

	test("returns null for unknown moves", () => {
		expect(getBaseMoveForAudio("nonexistent")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(getBaseMoveForAudio("")).toBeNull();
	});

	test("works for moves from each type category", () => {
		// Beer
		expect(getBaseMoveForAudio("barrelroll")).toBe("strength");
		// Shot
		expect(getBaseMoveForAudio("spiritburn")).toBe("fireblast");
		// Wine
		expect(getBaseMoveForAudio("grapewhip")).toBe("vinewhip");
		// Water
		expect(getBaseMoveForAudio("springgush")).toBe("hydropump");
		// Cocktail
		expect(getBaseMoveForAudio("olivetoss")).toBe("rockthrow");
	});
});

// ==========================================
// 6. getPubMonSprite
// ==========================================
describe("getPubMonSprite", () => {
	test("returns correct path for default variant", () => {
		expect(getPubMonSprite("hoppsin")).toBe(
			"/sprites/pubmon/Hoppsin_00001_.png",
		);
	});

	test("handles explicit variant", () => {
		expect(getPubMonSprite("hoppsin", 2)).toBe(
			"/sprites/pubmon/Hoppsin_00002_.png",
		);
	});

	test("capitalizes first letter correctly", () => {
		expect(getPubMonSprite("lagerite")).toBe(
			"/sprites/pubmon/Lagerite_00001_.png",
		);
	});

	test("pads variant to 5 digits", () => {
		expect(getPubMonSprite("stoutaur", 3)).toBe(
			"/sprites/pubmon/Stoutaur_00003_.png",
		);
		expect(getPubMonSprite("stoutaur", 12)).toBe(
			"/sprites/pubmon/Stoutaur_00012_.png",
		);
	});
});

// ==========================================
// 7. getMissingnoSprite
// ==========================================
describe("getMissingnoSprite", () => {
	test('returns "/sprites/pubmon/Missingno.png"', () => {
		expect(getMissingnoSprite()).toBe("/sprites/pubmon/Missingno.png");
	});
});

// ==========================================
// 8. getRandomPubMon
// ==========================================
describe("getRandomPubMon", () => {
	test("returns a PubMon of the requested type", () => {
		for (const type of ALL_TYPES) {
			const mon = getRandomPubMon(type);
			expect(mon.type).toBe(type);
		}
	});

	test("returns a copy, not the original object reference", () => {
		const mon = getRandomPubMon("beer");
		const original = ALL_PUBMON.find((m) => m.id === mon.id);
		expect(mon).not.toBe(original);
	});

	test("returned PubMon has hp === maxHp (full health)", () => {
		for (const type of ALL_TYPES) {
			const mon = getRandomPubMon(type);
			expect(mon.hp).toBe(mon.maxHp);
		}
	});

	test("works for all 5 types", () => {
		for (const type of ALL_TYPES) {
			const mon = getRandomPubMon(type);
			expect(mon).toBeDefined();
			expect(mon.name).toBeDefined();
		}
	});
});

// ==========================================
// 9. generatePubMonModData
// ==========================================
describe("generatePubMonModData", () => {
	const modData = generatePubMonModData();

	test("returns an object", () => {
		expect(typeof modData).toBe("object");
	});

	test("contains Species entries for all PubMon", () => {
		const species = modData.Species as Record<string, any>;
		expect(species).toBeDefined();
		for (const mon of ALL_PUBMON) {
			const speciesId = mon.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
			expect(species[speciesId]).toBeDefined();
		}
	});

	test("contains run and catch custom moves", () => {
		const moves = modData.Moves as Record<string, any>;
		expect(moves).toBeDefined();
		expect(moves["run"]).toBeDefined();
		expect(moves["catch"]).toBeDefined();
	});

	test("run move has priority 6", () => {
		const moves = modData.Moves as Record<string, any>;
		expect(moves["run"].priority).toBe(6);
	});

	test("catch move has priority 0", () => {
		const moves = modData.Moves as Record<string, any>;
		expect(moves["catch"].priority).toBe(0);
	});

	test("species IDs are lowercase alphanumeric", () => {
		const species = modData.Species as Record<string, any>;
		for (const key of Object.keys(species)) {
			expect(key).toMatch(/^[a-z0-9]+$/);
		}
	});

	test("all PubMon species have correct type based on PUBMON_TYPE_MAP", () => {
		const species = modData.Species as Record<string, any>;
		for (const mon of ALL_PUBMON) {
			const speciesId = mon.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
			const entry = species[speciesId];
			expect(entry.types).toEqual([PUBMON_TYPE_MAP[mon.type]]);
		}
	});

	test("contains Move entries for PubMon moves", () => {
		const moves = modData.Moves as Record<string, any>;
		for (const mon of ALL_PUBMON) {
			for (const moveName of mon.moves) {
				const moveId = moveName.toLowerCase().replace(/[^a-z0-9]+/g, "");
				expect(moves[moveId]).toBeDefined();
			}
		}
	});

	test("custom moves have valid base move properties", () => {
		const moves = modData.Moves as Record<string, any>;
		// Check a known move
		const grainslam = moves["grainslam"];
		expect(grainslam).toBeDefined();
		expect(grainslam.name).toBe("Grain Slam");
		expect(typeof grainslam.basePower).toBe("number");
		expect(typeof grainslam.accuracy).toBeDefined();
		expect(typeof grainslam.pp).toBe("number");
	});

	test("species entries have baseStats", () => {
		const species = modData.Species as Record<string, any>;
		for (const mon of ALL_PUBMON) {
			const speciesId = mon.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
			const entry = species[speciesId];
			expect(entry.baseStats).toBeDefined();
			expect(entry.baseStats.hp).toBe(mon.maxHp);
			expect(entry.baseStats.atk).toBe(mon.attack);
			expect(entry.baseStats.def).toBe(mon.defense);
		}
	});
});
