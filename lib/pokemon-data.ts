import type { ModData } from "@pkmn/dex-types";
import { Dex } from "@pkmn/sim";

export type PubType = "beer" | "shot" | "wine" | "water" | "cocktail";

export interface PubMon {
	id: number;
	name: string;
	type: PubType;
	hp: number;
	maxHp: number;
	level: number;
	xp: number;
	attack: number;
	defense: number;
	moves: string[];
	sprite: string; // pixel art character represented as CSS
	spriteVariant?: number; // which variant of the sprite to use (defaults to 1)
	description: string;
	cry: number; // audio file number (001-151)
	visuals: string; // pixel art character represented as CSS
}

export const TYPE_INFO: Record<
	PubType,
	{ label: string; element: string; color: string; bgColor: string }
> = {
	beer: {
		label: "Beer",
		element: "Earth",
		color: "#c28b4a",
		bgColor: "#3d2c14",
	},
	shot: {
		label: "Shot",
		element: "Fire",
		color: "#e43b44",
		bgColor: "#3d1418",
	},
	wine: {
		label: "Wine",
		element: "Fairy",
		color: "#f4a4c0",
		bgColor: "#3d1a2a",
	},
	water: {
		label: "Water",
		element: "Water",
		color: "#63c6e1",
		bgColor: "#142a3d",
	},
	cocktail: {
		label: "Cocktail",
		element: "Grass",
		color: "#63c74d",
		bgColor: "#1a3d14",
	},
};

/**
 * MOVE_MAPPINGS: Central dictionary mapping custom PubMon move names to Gen 1 move IDs
 * This ensures mechanical integrity by cloning all properties (damage, accuracy, effects)
 * from existing Gen 1 moves while maintaining themed PubMon names in the UI.
 */
export const MOVE_MAPPINGS: Record<string, string> = {
	// ==========================================
	// BEER (Earth / Physical)
	// ==========================================
	grainslam: "tackle",
	barrelroll: "strength",
	ambercharge: "takedown",
	headyfoam: "bubble", // Renamed from "foamburst" to avoid conflict with G-Max move
	yeastpunch: "megapunch",
	hornsmash: "horndrill",
	coldsnap: "icebeam",
	darkroast: "smog",
	copperpour: "watergun",
	goldenpour: "surf",
	horncharge: "hornattack",
	earthquaff: "earthquake",
	maltshield: "withdraw",
	barleystomp: "stomp",
	woodsplinter: "rockthrow",
	thickfoam: "barrier",
	paleglow: "flash",
	rollout: "doubleedge",
	crispstrike: "slash",
	glassshatter: "reflect",
	fermentingrest: "rest",
	bitterbite: "bite",
	citruspunch: "dizzypunch",
	heavytap: "bodyslam",
	hopswing: "thrash",
	primalbrew: "focusenergy",
	peachfuzz: "stunspore",
	applebite: "bite",
	orchardstrike: "pound",
	amberdrop: "watergun",
	fermentbreath: "confuseray",
	sweetspray: "watergun",
	lagerlunge: "quickattack",
	sweetsap: "leechseed",
	rusticwing: "wingattack",
	peppercorngust: "gust",
	funkyfeather: "sandattack",
	harvestdive: "skyattack",
	ironshell: "withdraw",
	darkroar: "roar",
	heavyporter: "bodyslam",
	roastroll: "dig",
	heavyhops: "stunspore",

	// ==========================================
	// SHOT (Fire / Poison / Fast)
	// ==========================================
	greenflame: "flamethrower",
	wormwoodhex: "toxic",
	spicyspit: "sludge",
	spiritburn: "fireblast",
	loucheflash: "flash",
	cinnamondust: "poisonpowder",
	agaveblaze: "flamethrower",
	saltsting: "poisonsting",
	ignite: "firespin",
	limeslash: "razorleaf",
	sunriseburst: "fireblast",
	recklessdash: "doubleedge",
	blackout: "hypnosis",
	embershot: "ember",
	firering: "firespin",
	clearflame: "flamethrower",
	mezcalsmoke: "smokescreen",
	pepperblast: "smog",
	potatosmash: "slam",
	barrelscratch: "scratch",
	neatstrike: "slash",
	winterchill: "aurorabeam",
	peatsmoke: "smog",
	felineproof: "defensecurl",
	distilledbeam: "icebeam",
	antlersmash: "headbutt",
	herbalbrew: "megadrain",
	zestbite: "bite",
	licoricebite: "bite",
	forestspirit: "amnesia",
	syruptrap: "stringshot",
	juniperphantom: "confuseray",
	botanicalhex: "leechseed",
	citrusspark: "thundershock",
	clearstrike: "slash",
	tonicillusion: "doubleteam",
	yellowflash: "quickattack",
	aniseflare: "firespin",
	beantoss: "eggbomb",
	stickysludge: "sludge",
	flamingshot: "ember",
	stickytrap: "stringshot",
	sugarcoma: "hypnosis",
	whiskeyburn: "flamethrower",
	velvettrap: "bind",
	molassessludge: "sludge",
	tentaclelash: "constrict",
	spicedink: "smokescreen",
	piratescurse: "nightshade",
	velvetpaw: "scratch",
	oakrest: "rest",
	snifterswirl: "whirlwind",
	vsoppounce: "quickattack",
	creamtackle: "tackle",
	cocoadust: "sleeppowder",
	soothingmoo: "growl",
	thickcoat: "harden",
	coffeevenom: "toxic",
	caffeinerattle: "supersonic",

	// ==========================================
	// WINE (Fairy / Psychic / Status)
	// ==========================================
	oakcharm: "tailwhip",
	vintageheal: "recover",
	crispbreeze: "gust",
	grapewhip: "vinewhip",
	sommelierstouch: "amnesia",
	tannintwist: "confuseray",
	grassknot: "bind",
	rubybeam: "psybeam",
	tanninshield: "reflect",
	floralscent: "stunspore",
	decantdance: "swordsdance",
	corkpop: "eggbomb",
	drycharm: "tailwhip",
	bubblescratch: "scratch",
	popcharm: "confuseray",
	caffeineerush: "agility",
	glerasparkle: "flash",
	felinefizz: "agility",
	sugarcrash: "rest",
	earthyaroma: "poisonpowder",
	velvetclaw: "slash",
	cherrystrike: "peck",
	noirveil: "smokescreen",
	chaosbabble: "confusion",
	citruscreech: "screech",
	crispbite: "bite",
	ironwing: "drillpeck",
	nightharvest: "dreameater",
	zestygust: "gust",
	vigorousbuzz: "supersonic",
	celebrationpop: "swift",
	vintageblast: "psychic",
	rootssmash: "slam",
	bubblyshield: "lightscreen",
	prestigestrike: "psychic",
	tonicdance: "swordsdance",
	kojicharm: "confuseray",
	ceramicsmash: "karatechop",
	steamveil: "mist",
	ricefire: "firespin",
	stickyhoney: "stringshot",
	bearhug: "bind",
	fermentsting: "twineedle",
	goldenbuzz: "supersonic",
	tonicthrash: "thrash",
	citrusscreech: "screech",

	// ==========================================
	// WATER (Water / Ice)
	// ==========================================
	springgush: "hydropump",
	purityshield: "lightscreen",
	coolslice: "slash",
	aquajet: "quickattack",
	mineralheal: "recover",
	aquatail: "surf",
	stillcalm: "amnesia",
	deepcurrent: "surf",
	refresh: "recover",
	aquawall: "barrier",
	cleansewave: "surf",
	brainfreeze: "glare",
	greenwave: "surf",
	bubbleburst: "bubble",
	fizzattack: "bubblebeam",
	syrupsnap: "bite",
	carbonation: "bubble",
	sparkleshot: "watergun",
	fizzydeathroll: "thrash",
	quinineblast: "bubblebeam",
	bitterspray: "watergun",
	acidicspit: "acid",
	tonicwave: "surf",
	citrusguard: "reflect",
	darkcaramel: "sludge",
	fizzyfang: "bite",
	co2coil: "wrap",
	orangepounce: "quickattack",
	clearstream: "watergun",
	mineralstrike: "slam",
	zestswipe: "scratch",
	freezeover: "blizzard",
	glaciercrash: "icepunch",
	stickypaws: "stringshot",
	meltingshield: "barrier",
	citrusroar: "roar",
	hydrationswoop: "skyattack",
	purewing: "wingattack",
	lemonlimeflash: "flash",
	nightdroplet: "waterfall",
	dewfeather: "sandattack",
	crispcut: "slash",
	clearglide: "agility",
	refreshingwind: "gust",
	stickyhooves: "stomp",

	// ==========================================
	// COCKTAIL (Grass / Flying)
	// ==========================================
	olivetoss: "rockthrow",
	shakenstrike: "thrash",
	coconutbomb: "eggbomb",
	vermouthvine: "vinewhip",
	garnishguard: "reflect",
	dirtyolive: "toxic",
	pineapplepeck: "peck",
	spritzshower: "bubblebeam",
	bitterbloom: "megadrain",
	creamygust: "gust",
	orangeslice: "razorleaf",
	sunsetbeam: "solarbeam",
	tropicalscreech: "screech",
	limecrush: "slam",
	sugarrush: "agility",
	tomatotang: "acid",
	muddlesmash: "megapunch",
	tropicalgale: "razorwind",
	celerywhip: "vinewhip",
	mintytongue: "lick",
	rumjump: "jumpkick",
	tabascoburn: "ember",
	icecrush: "icepunch",
	muddlehop: "stomp",
	hangovercure: "recover",
	bittersstrike: "karatechop",
	orangepeellash: "vinewhip",
	bourbonbash: "megapunch",
	muddledstomp: "stomp",
	saltrimstrike: "slash",
	agavewhip: "vinewhip",
	limeflutter: "gust",
	sunbathe: "growth",
	neonflare: "flamethrower",
	caffeinerush: "agility",
	taurinetail: "slam",
	blueraspburn: "ember",
};

/**
 * Reverse mapping for audio: custom move ID -> Gen 1 base move name
 * Used to trigger the correct sound effect when a custom move is used
 */
export function getBaseMoveForAudio(customMoveId: string): string | null {
	return MOVE_MAPPINGS[customMoveId.toLowerCase()] || null;
}

/**
 * Get the sprite path for a PubMon
 * Converts sprite identifiers like "hoppsin" to actual file paths
 * Falls back to Missingno.png if sprite not found
 */
export function getPubMonSprite(spriteId: string, variant: number = 1): string {
	// Capitalize first letter for file name format
	const capitalized = spriteId.charAt(0).toUpperCase() + spriteId.slice(1);
	const paddedVariant = String(variant).padStart(5, "0");
	return `/sprites/pubmon/${capitalized}_${paddedVariant}_.png`;
}

/**
 * Fallback sprite when a PubMon sprite is missing
 */
export function getMissingnoSprite(): string {
	return "/sprites/pubmon/Missingno.png";
}
export const ALL_PUBMON: PubMon[] = [
	// ==========================================
	// BEER (Earth)
	// ==========================================
	{
		id: 1,
		name: "Hoppsin",
		type: "beer",
		hp: 45,
		maxHp: 45,
		level: 5,
		xp: 0,
		attack: 12,
		defense: 10,
		moves: ["Grain Slam", "Heady Foam", "Barrel Roll", "Heavy Hops"],
		sprite: "hoppsin",
		spriteVariant: 2,
		description:
			"A hoppy creature born from the finest barley fields. Its foam mane bristles when angered.",
		visuals:
			"a fakemon, a quadrupedal beast formed from dense bundles of green barley and hops. Its coarse, vegetative anatomy is crowned by a thick, bubbling mane of white foam. Warm earthy greens and stark white highlights on the froth imply a rugged, organic volume that is constantly overflowing.",
		cry: 24,
	},
	{
		id: 2,
		name: "Lagerite",
		type: "beer",
		hp: 52,
		maxHp: 52,
		level: 5,
		xp: 0,
		attack: 10,
		defense: 14,
		moves: ["Cold Snap", "Golden Pour", "Barrel Roll", "Malt Shield"],
		sprite: "lagerite",
		spriteVariant: 4,
		description:
			"A smooth, golden creature that thrives in cool cellars. Calm and collected in battle.",
		visuals:
			"a fakemon, a sleek, reptilian biped composed of smooth, golden-amber fluid encased in a thin, frosty membrane. Its cool, translucent anatomy features sharp, bright specular reflections. The crisp yellow palette and soft condensation droplets give it a calm, deeply chilled materiality.",
		cry: 88,
	},
	{
		id: 3,
		name: "Stoutaur",
		type: "beer",
		hp: 55,
		maxHp: 55,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 15,
		moves: ["Dark Roast", "Horn Charge", "Barley Stomp", "Thick Foam"],
		sprite: "stoutaur",
		description:
			"A hulking beast made of dark, heavy earth. It hits with the force of a falling keg.",
		visuals:
			"a fakemon, a hulking, centaur-like beast constructed from dark, compacted earth and heavy roasted malt. A thick, creamy tan foam sits across its broad shoulders like a mantle. Deep, light-absorbing browns and blacks emphasize its massive, immovable weight.",
		cry: 142,
	},
	{
		id: 4,
		name: "Pilsenor",
		type: "beer",
		hp: 45,
		maxHp: 45,
		level: 5,
		xp: 0,
		attack: 12,
		defense: 12,
		moves: ["Crisp Strike", "Pale Glow", "Malt Shield", "Glass Shatter"],
		sprite: "pilsenor",
		description:
			"A bright and snappy PubMon. Its crystalline armor is fragile but dangerously sharp.",
		visuals:
			"a fakemon, a sharp, avian biped encased in fragile, crystalline glass armor over a bright yellow, fluid core. The translucent shell features harsh, angular specular highlights that imply dangerously sharp edges, contrasting with the warm, snappy golden liquid inside.",
		cry: 15,
	},
	{
		id: 5,
		name: "Ipape",
		type: "beer",
		hp: 48,
		maxHp: 48,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 9,
		moves: ["Bitter Bite", "Hop Swing", "Citrus Punch", "Primal Brew"],
		sprite: "ipape",
		spriteVariant: 5,
		description:
			"A primate that swings through trellises of hops. Its attacks have a famously bitter sting.",
		cry: 56,
		visuals:
			"a fakemon, a muscular primate with thick, rope-like vines of hops wrapping around its powerful arms. Its coarse, green-and-brown fur suggests a fibrous, bitter materiality. Deep shadows in the dense foliage of its mane imply a heavy, swinging, arboreal volume.",
	},
	{
		id: 6,
		name: "Cidra",
		type: "beer",
		hp: 42,
		maxHp: 42,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 10,
		moves: ["Apple Bite", "Ferment Breath", "Orchard Strike", "Sweet Spray"],
		sprite: "cidra",
		description:
			"Often found near fallen orchards, this multi-headed serpent ferments apples in its belly.",
		cry: 101,
		visuals:
			"a fakemon, a multi-headed serpentine hydra with scales resembling the mottled skin of fermented apples. Its bulbous bellies suggest heavy, fluid-filled internal fermentation. Rich autumnal reds and golds gleam with a sticky, sweet-and-sour wetness.",
	},
	{
		id: 7,
		name: "Alehorn",
		type: "beer",
		hp: 49,
		maxHp: 49,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 13,
		moves: ["Amber Charge", "Horn Smash", "Copper Pour", "Earth Quaff"],
		sprite: "alehorn",
		spriteVariant: 1,
		// spriteVariant: 5,
		description:
			"It charges foes with a heavy, foam-tipped horn. Highly territorial over pub tables.",
		cry: 112,
		visuals:
			"a fakemon, a stout, charging ungulate boasting a massive, foam-tipped horn resembling a heavy glass pint. Its dense, amber-colored coat features smooth, directional shading that implies a heavy, liquid-like fur texture, radiating territorial aggression.",
	},
	{
		id: 8,
		name: "Caskarok",
		type: "beer",
		hp: 60,
		maxHp: 60,
		level: 5,
		xp: 0,
		attack: 11,
		defense: 16,
		moves: ["Wood Splinter", "Rollout", "Fermenting Rest", "Heavy Tap"],
		sprite: "caskarok",
		spriteVariant: 3,
		description:
			"A sturdy golem made of bound oak staves. It sleeps for years in dark cellars to build defense.",
		cry: 74,
		visuals:
			"a fakemon, a sturdy, bipedal golem constructed from curved, dark oak staves bound by thick iron hoops. The heavy wooden anatomy features deep, matte crevices and metallic highlights on the rusted bands, implying an ancient, heavy, cellar-aged volume. two eyes poke out of the dark gaps.",
	},
	{
		id: 9,
		name: "Jubelite",
		type: "beer",
		hp: 44,
		maxHp: 44,
		level: 5,
		xp: 0,
		attack: 13,
		defense: 11,
		moves: ["Peach Fuzz", "Amber Drop", "Lager Lunge", "Sweet Sap"],
		sprite: "jubelite",
		description:
			"A sweet, earth-dwelling creature infused with peach nectar. Its fuzzy exterior softens physical blows.",
		cry: 39,
		visuals:
			"a fakemon, a small, spherical, subterranean creature radiating a soft peach-orange hue. Its entire body is covered in a thick, velvety fuzz that softens lighting into a warm, matte glow, concealing its dense, nectar-infused core.",
	},
	{
		id: 57,
		name: "Saiswan",
		type: "beer",
		hp: 41,
		maxHp: 41,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 9,
		moves: ["Rustic Wing", "Peppercorn Gust", "Funky Feather", "Harvest Dive"],
		sprite: "saiswan",
		description:
			"An elegant but wildly unpredictable bird found near farmhouse breweries. It attacks with a rustic, spicy flair that catches foes off guard.",
		cry: 128,
		visuals:
			"a fakemon, an elegant but erratic swan with rustic, wheat-colored plumage dotted with dark peppercorn specks. Its broad wings have a textured, papery quality, and warm golden-hour lighting highlights the untamed, spicy flair of its farmhouse origins.",
	},
	{
		id: 54,
		name: "Portoise",
		type: "beer",
		hp: 58,
		maxHp: 58,
		level: 5,
		xp: 0,
		attack: 11,
		defense: 17,
		moves: ["Iron Shell", "Dark Roar", "Heavy Porter", "Roast Roll"],
		sprite: "portoise",
		spriteVariant: 4,
		description:
			"A plodding, deeply dependable reptile. The massive, iron-bound keg it uses as a shell makes it an absolute tank in battle.",
		visuals:
			"a fakemon, a plodding, tank-like tortoise whose shell is an actual, massive iron-bound wooden keg. The deeply scored oak and oxidized metal rings feature rigid, unyielding textures, emphasizing an incredibly heavy, immovable, defensive silhouette.",
		cry: 81,
	},

	// ==========================================
	// SHOT (Fire)
	// ==========================================
	{
		id: 10,
		name: "Absintile",
		type: "shot",
		hp: 38,
		maxHp: 38,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 7,
		moves: ["Green Flame", "Wormwood Hex", "Spirit Burn", "Louche Flash"],
		sprite: "absintile",
		spriteVariant: 1,
		description:
			"A mysterious green spirit wreathed in ethereal flames. Its gaze induces hallucinations.",
		cry: 93,
		visuals:
			"a fakemon, a floating, ethereal spirit wreathed in intensely bright, ghostly green flames. Its translucent, fluid-like core shifts unpredictably, catching light with an unsettling, hallucinatory iridescence that defies solid volume.",
	},
	{
		id: 11,
		name: "Tequilar",
		type: "shot",
		hp: 40,
		maxHp: 40,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 8,
		moves: ["Agave Blaze", "Salt Sting", "Lime Slash", "Blackout"],
		sprite: "tequilar",
		description:
			"A fiery desert dweller with crystalline salt armor. Attacks with citrus precision.",
		cry: 41,
		visuals:
			"a fakemon, a fiery, desert-dwelling biped armored in sharp, crystalline salt formations. Vivid, hot orange internal flames shine through the semi-transparent salt crust, highlighting jagged, citrus-green appendages and an aggressive, sharp silhouette.",
	},
	{
		id: 12,
		name: "Cazcabuzz",
		type: "shot",
		hp: 42,
		maxHp: 42,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 9,
		moves: ["Ember Shot", "Coffee Venom", "Fire Ring", "Caffeine Rattle"],
		sprite: "cazcabuzz",
		spriteVariant: 1,
		description:
			"A hyperactive rattlesnake steeped in roasted coffee. Its tail shakes with lethal, jittery energy.",
		cry: 120,
		visuals:
			"a fakemon, a highly energized rattlesnake made of roasted coffee beans and glowing amber liquid. Its tail is a literal maraca of grinding coffee beans, and bright, jittery specular highlights emphasize a highly caffeinated, aggressive serpentine volume.",
	},
	{
		id: 13,
		name: "Whisker",
		type: "shot",
		hp: 38,
		maxHp: 38,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 8,
		moves: ["Barrel Scratch", "Neat Strike", "Peat Smoke", "Feline Proof"],
		sprite: "whisker",
		description:
			"A feline spirit aged in oak. It leaves behind a trail of warm, smoky embers.",
		cry: 52,
		visuals:
			"a fakemon, a lithe feline spirit composed of warm, glowing embers and aged oak bark. As it moves, its tail trails thick, volumetric peat smoke. Deep coppers and fiery oranges glow softly from within its wooden, barrel-aged exterior.",
	},
	{
		id: 14,
		name: "Jagerstag",
		type: "shot",
		hp: 45,
		maxHp: 45,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 11,
		moves: ["Antler Smash", "Herbal Brew", "Licorice Bite", "Forest Spirit"],
		sprite: "jagerstag",
		description:
			"A proud deer that roams the black forests. It draws power from 56 secret botanicals.",
		cry: 135,
		visuals:
			"a fakemon, a proud, spectral stag roaming on legs of dark, herbaceous shadow. Its massive antlers glow with a dark, licorice-colored fire. Intricate, botanical textures are etched into its dark, matte coat, implying ancient, secret forest magic.",
	},
	{
		id: 15,
		name: "Gingeist",
		type: "shot",
		hp: 36,
		maxHp: 36,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 7,
		moves: [
			"Juniper Phantom",
			"Botanical Hex",
			"Clear Strike",
			"Tonic Illusion",
		],
		sprite: "gingeist",
		description:
			"A translucent poltergeist that smells heavily of pine. Hard to hit, harder to track.",
		cry: 9,
		visuals:
			"a fakemon, a translucent, ghostly poltergeist with a distinct, pine-needle-like jagged silhouette. The clear, glass-like body bends light through refraction, making its icy-blue core almost invisible save for crisp, freezing edge highlights.",
	},
	{
		id: 16,
		name: "Samburst",
		type: "shot",
		hp: 35,
		maxHp: 35,
		level: 5,
		xp: 0,
		attack: 18,
		defense: 6,
		moves: ["Anise Flare", "Bean Toss", "Flaming Shot", "Sticky Trap"],
		sprite: "samburst",
		description:
			"It carries three lucky coffee beans on its head. Ignites itself for massive, reckless damage.",
		cry: 63,
		visuals:
			"a fakemon, a tiny, hyperactive imp whose head is crowned with three distinct, coffee-bean-shaped nodes. The body is engulfed in reckless, sticky blue-and-purple flames. Bright, aggressive specular highlights imply a dangerous, syrupy, highly flammable volume.",
	},
	{
		id: 17,
		name: "Cinnaburn",
		type: "shot",
		hp: 37,
		maxHp: 37,
		level: 5,
		xp: 0,
		attack: 17,
		defense: 6,
		moves: ["Spicy Spit", "Cinnamon Dust", "Ignite", "Reckless Dash"],
		sprite: "cinnaburn",
		spriteVariant: 5,
		description:
			"A highly aggressive imp that smells of winter spices. It spits liquid fire when startled.",
		cry: 4,
		visuals:
			"a fakemon, a highly aggressive, impish creature dripping with viscous, glowing red liquid fire. The texture implies a thick, spicy syrup rather than pure flame, with rounded, glossy highlights that emphasize its sticky, volatile nature.",
	},
	{
		id: 18,
		name: "Shivernoff",
		type: "shot",
		hp: 43,
		maxHp: 43,
		level: 5,
		xp: 0,
		attack: 13,
		defense: 12,
		moves: ["Clear Flame", "Potato Smash", "Winter Chill", "Distilled Beam"],
		sprite: "shivernoff",
		description:
			"Despite being a Fire-type, its flames burn cold and clear. It thrives in freezing climates.",
		cry: 144,
		visuals:
			"a fakemon, a stout, bipedal elemental whose flames burn a completely clear, icy white-blue. Its crystalline structure mimics solid ice but radiates intense, paradoxical heat, featuring sharp, glass-like facets and freezing vapor trails.",
	},
	{
		id: 19,
		name: "Limonchilla",
		type: "shot",
		hp: 39,
		maxHp: 39,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 8,
		moves: ["Zest Bite", "Syrup Trap", "Citrus Spark", "Yellow Flash"],
		sprite: "limonchilla",
		spriteVariant: 3,
		description:
			"A zesty, energetic rodent wreathed in sweet, yellow fire. Leaves a sticky trail behind it.",
		cry: 25,
		visuals:
			"a fakemon, an energetic, rodent-like creature with a coat of intensely vibrant, zesty yellow fire. Its tail trails a thick, syrupy, glowing residue. Sharp, citrus-bright highlights give its form an electric, sugary pop.",
	},
	{
		id: 49,
		name: "Whiscream",
		type: "shot",
		hp: 60,
		maxHp: 60,
		level: 5,
		xp: 0,
		attack: 11,
		defense: 17,
		moves: ["Sticky Sludge", "Sugar Coma", "Whiskey Burn", "Velvet Trap"],
		sprite: "whiscream",
		description:
			"An amorphous, slow-moving ooze of sweet cream and spirits. Physical attacks simply sink into its thick, velvety body.",
		cry: 33,
		visuals:
			"a fakemon, an amorphous, slow-moving ooze of rich, velvety cream marbled with warm amber spirits. Its utterly fluid, non-Newtonian anatomy features soft, heavy folds and smooth, sweeping specular highlights that emphasize a thick, suffocating sweetness.",
	},
	{
		id: 47,
		name: "Krakenum",
		type: "shot",
		hp: 50,
		maxHp: 50,
		level: 5,
		xp: 0,
		attack: 17,
		defense: 11,
		spriteVariant: 4,
		moves: ["Molasses Sludge", "Tentacle Lash", "Spiced Ink", "Pirate's Curse"],
		sprite: "krakenum",
		description:
			"A dark, spiced cephalopod that dwells in oak barrels. It strikes with heavy, molasses-coated tentacles.",
		cry: 144,
		visuals:
			"a fakemon, a dark, menacing cephalopod emerging from a shattered oak barrel. Its massive, heavy tentacles are coated in a thick, black molasses sludge, capturing light with oily, iridescent reflections over a deep spiced-rum-colored body.",
	},
	{
		id: 48,
		name: "Cognacat",
		type: "shot",
		hp: 42,
		maxHp: 42,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 12,
		moves: ["Velvet Paw", "Oak Rest", "Snifter Swirl", "V.S.O.P. Pounce"],
		sprite: "cognacat",
		description:
			"An aristocratic feline that demands to be warmed by the fire before battling. Highly sophisticated and aloof.",
		cry: 67,
		visuals:
			"a fakemon, an aristocratic, aloof feline with a coat that resembles rich, polished mahogany and velvet. Warm, fireside lighting graces its smooth, snifter-shaped silhouette, emphasizing a highly sophisticated, plush, and warming materiality.",
	},
	{
		id: 53,
		name: "Bovileys",
		type: "shot",
		hp: 55,
		maxHp: 55,
		level: 5,
		xp: 0,
		attack: 10,
		defense: 16,
		moves: ["Cream Tackle", "Cocoa Dust", "Soothing Moo", "Thick Coat"],
		sprite: "bovileys",
		spriteVariant: 4,
		description:
			"A gentle, sluggish bovine with a rich, creamy coat. It often puts aggressive opponents to sleep with its sweet aroma.",
		cry: 22,
		visuals:
			"a fakemon, a gentle, sluggish bovine covered in a thick, heavy coat of off-white cream and cocoa dusting. Its sluggish anatomy is incredibly soft and pillowy, with muted, warm lighting that implies a soothing, aromatic, and heavy physical presence.",
	},

	// ==========================================
	// WINE (Fairy)
	// ==========================================
	{
		id: 20,
		name: "Charderan",
		type: "wine",
		hp: 44,
		maxHp: 44,
		level: 5,
		xp: 0,
		attack: 11,
		defense: 12,
		moves: ["Oak Charm", "Vintage Heal", "Grape Whip", "Tannin Twist"],
		sprite: "charderan",
		spriteVariant: 4,
		description:
			"An elegant fairy-type aged to perfection. Its aroma calms even the fiercest foes.",
		cry: 68,
		visuals:
			"a fakemon, an elegant, humanoid fairy draped in flowing, pale-gold, vine-like appendages resembling aged oak leaves. Soft, buttery yellow lighting and smooth, graceful curves imply a calming, perfectly balanced, and refined organic volume.",
	},
	{
		id: 21,
		name: "Bordeauxt",
		type: "wine",
		hp: 48,
		maxHp: 48,
		level: 5,
		xp: 0,
		attack: 13,
		defense: 11,
		moves: ["Ruby Beam", "Tannin Shield", "Decant Dance", "Cork Pop"],
		sprite: "bordeauxt",
		spriteVariant: 1,
		description:
			"A majestic mountain goat with heavy, twisting horns made of tannin-rich grapevines.",
		cry: 104,
		visuals:
			"a fakemon, a majestic, brooding mountain goat with deep ruby-red fur that absorbs light like crushed velvet. Its heavy, twisting horns resemble thick, dark grapevines, projecting an aura of heavy, grounded elegance and deep, complex flavor.",
	},
	{
		id: 22,
		name: "Prossecat",
		type: "wine",
		hp: 40,
		maxHp: 40,
		level: 5,
		xp: 0,
		attack: 12,
		defense: 10,
		moves: ["Bubble Scratch", "Pop Charm", "Glera Sparkle", "Feline Fizz"],
		sprite: "prossecat",
		spriteVariant: 1,
		description:
			"A bubbly, hyperactive cat-like fairy. It bounces around wildly, disorienting opponents.",
		cry: 53,
		visuals:
			"a fakemon, a bouncy, feline fairy completely engulfed in a cloud of pale gold, effervescent bubbles. Its hyperactive, wiry anatomy is somewhat obscured by the crisp, sparkling spheres that pop and refract light in all directions.",
	},
	{
		id: 23,
		name: "Pinota",
		type: "wine",
		hp: 46,
		maxHp: 46,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 11,
		moves: ["Earthy Aroma", "Velvet Claw", "Cherry Strike", "Noir Veil"],
		sprite: "pinota",
		description:
			"A highly sensitive, brooding fairy-type that requires a very specific climate to thrive.",
		cry: 122,
		visuals:
			"a fakemon, a brooding, delicate fairy with thin, frail limbs and a cloak of deep, bruised-purple grape leaves. Its highly sensitive anatomy features sharp, angular shadows and a muted, earthy palette that conveys a moody, complex materiality.",
	},
	{
		id: 24,
		name: "Blancbat",
		type: "wine",
		hp: 38,
		maxHp: 38,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 9,
		moves: ["Citrus Screech", "Crisp Bite", "Night Harvest", "Zesty Gust"],
		sprite: "blancbat",
		spriteVariant: 5,
		description:
			"A nocturnal fairy that swoops down with a dry, piercing screech that cuts through defenses.",
		cry: 41,
		visuals:
			"a fakemon, a nocturnal, bat-like fairy with crisp, pale-green, translucent wings that resemble thin grape skins. Sharp, zesty specular highlights along its aerodynamic body suggest a dry, biting, and swiftly moving airborne volume.",
	},
	{
		id: 25,
		name: "Champain",
		type: "wine",
		hp: 42,
		maxHp: 42,
		level: 5,
		xp: 0,
		attack: 13,
		defense: 10,
		moves: [
			"Celebration Pop",
			"Vintage Blast",
			"Bubbly Shield",
			"Prestige Strike",
		],
		sprite: "champain",
		description:
			"Only true Champain hail from a specific region; all others are merely sparkling mimics.",
		cry: 149,
		visuals:
			"a fakemon, an elite, regal fairy adorned in prestige armor that mimics polished, pale-gold glass and popping corks. Radiant, celebratory lighting catches the high-gloss, bubbly shield around its body, projecting an aura of explosive, expensive energy.",
	},
	{
		id: 26,
		name: "Sauviflora",
		type: "wine",
		hp: 41,
		maxHp: 41,
		level: 5,
		xp: 0,
		attack: 12,
		defense: 10,
		moves: ["Crisp Breeze", "Grass Knot", "Floral Scent", "Dry Charm"],
		sprite: "sauviflora",
		spriteVariant: 6,
		description:
			"A delicate fairy that hides among green vines. Its attacks have a sharp, grassy finish.",
		cry: 45,
		visuals:
			"a fakemon, a delicate, hiding fairy camouflaged entirely within crisp green vines and dry grassy leaves. Its thin, floral anatomy features matte, botanical textures with sharp, zesty green hues, implying a light, airy, and fragrant volume.",
	},
	{
		id: 27,
		name: "Buckfiend",
		type: "wine",
		hp: 44,
		maxHp: 44,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 7,
		moves: ["Caffeine Rush", "Sugar Crash", "Tonic Thrash", "Chaos Babble"],
		sprite: "buckfiend",
		spriteVariant: 3,
		description:
			"A chaotic, hyperactive gremlin fueled by sugar and caffeine. Unpredictable and dangerous.",
		cry: 56,
		visuals:
			"a fakemon, a chaotic, hyperactive gremlin vibrating with erratic energy. Its jagged, asymmetrical anatomy pulses with clashing sugary pinks and caffeinated neon greens. Sharp, fractured highlights imply an unpredictable, dangerously unstable chemistry.",
	},
	{
		id: 28,
		name: "Magnumoth",
		type: "wine",
		hp: 55,
		maxHp: 55,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 15,
		moves: ["Iron Wing", "Vigorous Buzz", "Roots Smash", "Tonic Dance"],
		sprite: "magnumoth",
		description:
			"A vigorous, iron-forged fairy-type fueled by Jamaican roots and vitamins. It dances relentlessly.",
		cry: 131,
		visuals:
			"a fakemon, a vigorous, heavily-built moth with thick, iron-forged metallic wings and a fuzzy, dark-brown root-like torso. A clashing palette of medicinal herbs and Jamaican rum colors grounds its surprisingly heavy, dense, and relentless fairy-type anatomy.",
	},
	{
		id: 50,
		name: "Kitsake",
		type: "wine",
		hp: 43,
		maxHp: 43,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 10,
		moves: ["Koji Charm", "Ceramic Smash", "Steam Veil", "Rice Fire"],
		sprite: "kitsake",
		description:
			"A mystical fox spirit born from polished rice. It can fight either pipingly hot or chillingly cold, confusing foes.",
		cry: 115,
		visuals:
			"a fakemon, a mystical, multi-tailed fox spirit composed of polished, pearlescent white rice grains. Its fluid anatomy shifts between emitting pipingly hot steam and chilling frost, featuring a clean, milky-white translucency with soft, ceramic-like highlights.",
	},
	{
		id: 51,
		name: "Meadhorn",
		type: "wine",
		hp: 52,
		maxHp: 52,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 13,
		moves: ["Sticky Honey", "Bear Hug", "Ferment Sting", "Golden Buzz"],
		sprite: "meadhorn",
		spriteVariant: 3,
		description:
			"An ancient, buzzing warrior favored by Vikings. Its golden armor is incredibly sticky, trapping physical attackers.",
		cry: 133,
		visuals:
			"a fakemon, an ancient, armored bee-like warrior dripping in incredibly thick, golden, fermented honey. The rich, amber armor catches light with a dense, sticky, and syrupy high-gloss finish, contrasting with its fuzzy, buzzing, Viking-inspired undercoat.",
	},

	// ==========================================
	// WATER (Water)
	// ==========================================
	{
		id: 29,
		name: "Springer",
		type: "water",
		hp: 50,
		maxHp: 50,
		level: 5,
		xp: 0,
		attack: 10,
		defense: 13,
		moves: ["Spring Gush", "Purity Shield", "Aqua Jet", "Mineral Heal"],
		sprite: "springer",
		description:
			"A crystal-clear water spirit from mountain springs. Purest of all PubMon.",
		cry: 11,
		visuals:
			"a fakemon, a pure, quadrupedal water spirit whose anatomy is made entirely of crystal-clear, flowing spring water. Complete translucency and high-refraction specular highlights emphasize a flawless, clean, and constantly undulating liquid volume.",
	},
	{
		id: 30,
		name: "Stillbar",
		type: "water",
		hp: 46,
		maxHp: 46,
		level: 5,
		xp: 0,
		attack: 9,
		defense: 15,
		moves: ["Still Calm", "Deep Current", "Aqua Wall", "Brain Freeze"],
		sprite: "stillbar",
		spriteVariant: 3,
		description:
			"A tranquil water guardian. Its still surface hides incredible defensive power.",
		cry: 77,
		visuals:
			"a fakemon, a tranquil, monolithic aquatic guardian with a perfectly smooth, mirror-like surface. The dark, deep-blue, glass-like exterior implies immense, unyielding pressure and defensive mass, absorbing all ripples into a heavy, still form.",
	},
	{
		id: 31,
		name: "Sparklid",
		type: "water",
		hp: 42,
		maxHp: 42,
		level: 5,
		xp: 0,
		attack: 12,
		defense: 11,
		moves: ["Bubble Burst", "Fizz Attack", "Carbonation", "Sparkle Shot"],
		sprite: "sparklid",
		spriteVariant: 7,
		description: "A bubbly, energetic creature covered in effervescent orbs.",
		cry: 32,
		visuals:
			"a fakemon, a bubbly, spherical aquatic creature covered entirely in tightly packed, effervescent orbs of carbonation. The sheer density of tiny, highly reflective bubbles gives its form a frantic, popping, and weightless visual texture.",
	},
	{
		id: 32,
		name: "Tonica",
		type: "water",
		hp: 44,
		maxHp: 44,
		level: 5,
		xp: 0,
		attack: 11,
		defense: 12,
		moves: ["Quinine Blast", "Bitter Spray", "Tonic Wave", "Citrus Guard"],
		sprite: "tonica",
		spriteVariant: 3,
		description:
			"A bitter-sweet water creature with a distinctive glow under UV light.",
		cry: 99,
		visuals:
			"a fakemon, a sleek, hydrodynamic swimmer that emits a distinct, eerie blue-violet glow reminiscent of UV-reactive quinine. Its semi-translucent, bitter-tasting skin is slick and rubbery, cutting through the dark water with crisp, glowing lines.",
	},
	{
		id: 33,
		name: "Seltzerpent",
		type: "water",
		hp: 45,
		maxHp: 45,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 9,
		moves: ["Fizzy Fang", "CO2 Coil", "Clear Stream", "Mineral Strike"],
		sprite: "seltzerpent",
		spriteVariant: 4,
		description:
			"A snake made of rapidly rising bubbles. It constricts foes before erupting in fizz.",
		cry: 118,
		visuals:
			"a fakemon, a long, coiling snake formed from a pressurized stream of rapidly rising, clear bubbles. Its fluid, glass-like anatomy lacks a solid core, defined entirely by the harsh, wet, white specular highlights of its fizzy, erupting edges.",
	},
	{
		id: 34,
		name: "Cuberg",
		type: "water",
		hp: 55,
		maxHp: 55,
		level: 5,
		xp: 0,
		attack: 9,
		defense: 18,
		moves: ["Freeze Over", "Glacier Crash", "Melting Shield", "Cold Snap"],
		sprite: "cuberg",
		spriteVariant: 4,
		description:
			"A slow-moving monolith of solid ice. It is often found cooling down fiery Shot types.",
		cry: 143,
		visuals:
			"a fakemon, a slow-moving, geometric monolith carved from a single, colossal block of solid, deep-blue glacier ice. Sharp, internal crystalline fractures and frosty, matte edges contrast with high-gloss melting faces, indicating immense frozen weight.",
	},
	{
		id: 35,
		name: "H2Owl",
		type: "water",
		hp: 40,
		maxHp: 40,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 8,
		moves: ["Hydration Swoop", "Pure Wing", "Night Droplet", "Dew Feather"],
		sprite: "h2owl",
		description:
			"A wise, fluid avian that keeps the pub ecosystem hydrated and functioning smoothly.",
		cry: 85,
		visuals:
			"a fakemon, a wise, fluid avian whose feathers are perfectly formed, heavy droplets of pure morning dew. Its large, dark eyes contrast with the translucent, watery plumage, creating a soft, deeply hydrated, and smoothly flowing aerial silhouette.",
	},
	{
		id: 36,
		name: "Cucumbrax",
		type: "water",
		hp: 47,
		maxHp: 47,
		level: 5,
		xp: 0,
		attack: 11,
		defense: 14,
		moves: ["Cool Slice", "Aqua Tail", "Refresh", "Green Wave"],
		sprite: "cucumbrax",
		spriteVariant: 5,
		description:
			"A remarkably cool-headed serpent. It glides through ice water, slicing foes with rigid fins.",
		cry: 10,
		visuals:
			"a fakemon, a remarkably cool, elongated sea serpent with skin resembling the taut, rigid green rind of a cucumber. Crisp, pale-green aquatic fins slice cleanly through the water, highlighted by slick, wet reflections over a hard, vegetative surface.",
	},
	{
		id: 44,
		name: "Crocacola",
		type: "water",
		hp: 52,
		maxHp: 52,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 14,
		moves: ["Syrup Snap", "Fizzy Death Roll", "Acidic Spit", "Dark Caramel"],
		sprite: "crocacola",
		spriteVariant: 1,
		description:
			"A dark, heavily armored reptile that lurks in sticky soda fountains. Bubbles constantly hiss from between its scales.",
		cry: 42,
		visuals:
			"a fakemon, a dark, heavy-set crocodilian heavily armored in thick, sticky, caramel-colored scales. Its massive jaws constantly hiss with effervescent carbonation. Deep, syrupy browns and stark, wet specular highlights imply a dense, sugary, and caustic mass.",
	},
	{
		id: 45,
		name: "Fantelope",
		type: "water",
		hp: 45,
		maxHp: 45,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 9,
		moves: ["Orange Pounce", "Zest Swipe", "Sticky Hooves", "Citrus Roar"],
		sprite: "fantelope",
		spriteVariant: 2,
		description:
			"A brightly colored antelope bursting with artificial energy. Its neon horns sizzle with carbonation.",
		cry: 89,
		visuals:
			"a fakemon, a wildly hyper antelope bursting with neon orange and vivid artificial hues. Its horns are made of carbonated, bright orange liquid that fizzes constantly. The hyper-saturated, zesty colors scream of high-fructose, energetic aquatic power.",
	},
	{
		id: 46,
		name: "Spritely",
		type: "water",
		hp: 38,
		maxHp: 38,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 10,
		moves: ["Lemon-Lime Flash", "Crisp Cut", "Clear Glide", "Refreshing Wind"],
		sprite: "spritely",
		spriteVariant: 3,
		description:
			"A translucent, darting sprite that mimics the fairies of the Wine class. Its attacks are exceptionally crisp and clean.",
		cry: 18,
		visuals:
			"a fakemon, a darting, translucent aquatic sprite with a brilliantly crisp lemon-lime color palette. Its aerodynamic, teardrop-shaped anatomy is almost invisible in the water, save for sharp, clean flashes of green and yellow specular light.",
	},

	// ==========================================
	// COCKTAIL (Grass)
	// ==========================================
	{
		id: 37,
		name: "Martini",
		type: "cocktail",
		hp: 40,
		maxHp: 40,
		level: 5,
		xp: 0,
		attack: 14,
		defense: 10,
		moves: ["Olive Toss", "Shaken Strike", "Vermouth Vine", "Dirty Olive"],
		sprite: "martini",
		spriteVariant: 5,
		description:
			"A suave grass-type with a crystal-clear body and a single olive antenna.",
		cry: 17,
		visuals:
			"a fakemon, a suave, bipedal grass-type with a sharp, triangular, glass-like torso filled with completely clear fluid. A single, oversized olive on a thin, woody skewer acts as an antenna. Its sleek, minimalist design implies sophisticated, high-tension fluid volume.",
	},
	{
		id: 38,
		name: "Aperol",
		type: "cocktail",
		hp: 43,
		maxHp: 43,
		level: 5,
		xp: 0,
		attack: 13,
		defense: 11,
		moves: ["Spritz Shower", "Bitter Bloom", "Orange Slice", "Sunset Beam"],
		sprite: "aperol",
		spriteVariant: 2,
		description: "An orange-tinted grass creature that blooms at golden hour.",
		cry: 64,
		visuals:
			"a fakemon, a radiant, botanical creature blooming with broad, translucent orange petals that catch the light like a setting sun. The delicate, bitter-sweet floral anatomy features a vivid, golden-hour glow and soft, velvety textures across its sunset-colored body.",
	},
	{
		id: 39,
		name: "Caiprinha",
		type: "cocktail",
		hp: 41,
		maxHp: 41,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 9,
		moves: ["Lime Crush", "Sugar Rush", "Muddle Smash", "Tropical Gale"],
		sprite: "caiprinha",
		description:
			"A tropical grass warrior with lime-green armor. Fights with raw, muddled power.",
		cry: 83,
		visuals:
			"a fakemon, a stout, tropical warrior encased in thick, heavily muddled lime-green rind armor. Its coarse, sugary exterior features granular, crystalline highlights that contrast with the raw, wet, bruised plant matter of its powerful, bipedal form.",
	},
	{
		id: 40,
		name: "Mojitoad",
		type: "cocktail",
		hp: 48,
		maxHp: 48,
		level: 5,
		xp: 0,
		attack: 12,
		defense: 14,
		moves: ["Minty Tongue", "Rum Jump", "Ice Crush", "Muddle Hop"],
		sprite: "mojitoad",
		spriteVariant: 1,
		description:
			"An amphibious grass-type that hides in dense mint patches, waiting to spring.",
		cry: 29,
		visuals:
			"a fakemon, a squat, amphibious creature whose warty, wet skin seamlessly blends into a dense patch of jagged mint leaves. Crushed, translucent ice crystals cling to its back, providing sharp, wet specular highlights over its earthy, vibrant green body.",
	},
	{
		id: 41,
		name: "Coladactyl",
		type: "cocktail",
		hp: 40,
		maxHp: 40,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 9,
		moves: [
			"Coconut Bomb",
			"Pineapple Peck",
			"Creamy Gust",
			"Tropical Screech",
		],
		sprite: "coladactyl",
		spriteVariant: 2,
		description:
			"A prehistoric flyer caught in a perpetual vacation state. Drops coconuts from high altitudes.",
		cry: 138,
		visuals:
			"a fakemon, a prehistoric, avian grass-type with massive, fibrous palm-frond wings and a tough, hairy, coconut-like chest cavity. Its tropical, aerodynamic form features a creamy, off-white crest, blending heavy, woody textures with smooth, milky highlights.",
	},
	{
		id: 42,
		name: "Maryvine",
		type: "cocktail",
		hp: 50,
		maxHp: 50,
		level: 5,
		xp: 0,
		attack: 11,
		defense: 13,
		moves: ["Tomato Tang", "Celery Whip", "Tabasco Burn", "Hangover Cure"],
		sprite: "maryvine",
		description:
			"A restorative but deeply savory plant. Its celery stalks act as protective spears.",
		cry: 72,
		visuals:
			"a fakemon, a deeply savory, rooted plant creature anchored by a thick, pulpy, blood-red tomato core. Tall, rigid celery stalks act as protective spears. Deep, rich reds and intense, peppery textures imply a thick, restorative, and highly caustic biological soup.",
	},
	{
		id: 43,
		name: "Oldfash",
		type: "cocktail",
		hp: 46,
		maxHp: 46,
		level: 5,
		xp: 0,
		attack: 15,
		defense: 11,
		moves: [
			"Bitters Strike",
			"Orange Peel Lash",
			"Bourbon Bash",
			"Muddled Stomp",
		],
		sprite: "oldfash",
		description:
			"A traditionalist PubMon that refuses to evolve. It relies on tried-and-true physical strikes.",
		cry: 108,
		visuals:
			"a fakemon, a rugged, traditionalist biped whose thick, woody skin is steeped in dark amber bitters and topped with a curling, whip-like orange peel. The dense, barrel-aged texture of its torso implies heavy, immovable, physical striking power.",
	},
	{
		id: 52,
		name: "Margaray",
		type: "cocktail",
		hp: 45,
		maxHp: 45,
		level: 5,
		xp: 0,
		attack: 16,
		defense: 11,
		spriteVariant: 3,
		moves: ["Salt Rim Strike", "Agave Whip", "Lime Flutter", "Sunbathe"],
		sprite: "margaray",
		description:
			"A flat, gliding ray that skims the top of bar counters. Its jagged tail is coated in coarse, stinging salt.",
		cry: 76,
		visuals:
			"a fakemon, a flat, gliding aquatic-grass hybrid shaped like an elegant manta ray. Its smooth, lime-green back features a wet, tart sheen, while its jagged, sweeping edges are thickly encrusted with coarse, stinging, crystalline salt catching harsh light.",
	},
	{
		id: 58,
		name: "Sagondroop",
		type: "cocktail",
		hp: 42,
		maxHp: 42,
		level: 5,
		xp: 0,
		attack: 18,
		defense: 7,
		moves: ["Neon Flare", "Caffeine Rush", "Taurine Tail", "Blue Rasp Burn"],
		sprite: "sagondroop",
		spriteVariant: 1,
		description:
			"A wildly hyperactive eastern dragon fueled by guarana and taurine. It breathes a crackling, sticky, blue-raspberry flavored flame.",
		cry: 188,
		visuals:
			"a fakemon, a twitchy, serpentine eastern dragon bursting with blinding neon blue and bright red metallic scales. It vibrates constantly with chaotic, caffeinated energy, with electric-blue static popping around its jagged, metallic whiskers.",
	},
];

export function getRandomPubMon(type: PubType): PubMon {
	const pool = ALL_PUBMON.filter((p) => p.type === type);
	const selected = pool[Math.floor(Math.random() * pool.length)];
	return { ...selected, hp: selected.maxHp };
}

// 1. Map custom PubTypes to valid Gen 1 Pokémon types
export const PUBMON_TYPE_MAP: Record<PubType, string> = {
	beer: "Ground",
	shot: "Fire",
	wine: "Poison", // Fairy doesn't exist in Gen 1
	water: "Water",
	cocktail: "Grass",
};

// 2. Generate the ModData required by @pkmn/dex and @pkmn/sim
export function generatePubMonModData(): ModData {
	const Species: Record<string, any> = {};
	const Moves: Record<string, any> = {};

	Moves['run'] = {
    num: 2000,
    accuracy: true,
    basePower: 0,
    category: "Status",
    name: "Run",
    pp: 99,
    noPPBoosts: true,
    priority: 6, // Runs usually happen before moves (like switching)
    onTryHit(source, target) {
        // Your Run Logic (example)
        const canEscape = source.speed >= target.speed || Math.random() > 0.5;

        if (canEscape) {
            this.add('|message|You escaped safely!');
            this.win(source.side.name); // Ends the battle
            return null;
        } else {
            // This is the "Skip Turn" part
            this.add('-activate', source, 'move: Run');
            this.add('|cant', source, 'trapped');
            return false; // Move fails, turn is consumed
        }
    },
    secondary: null,
    target: "self",
    type: "Water", // Type doesn't matter for logic
};

Moves['catch'] = {
    num: 2001,
    accuracy: true,
    basePower: 0,
    category: "Status",
    name: "Catch",
    pp: 99,
    noPPBoosts: true,
    priority: 0,
    onTryHit(target, source) {
        this.add('-activate', source, 'move: Catch');

        // Catch Math (very simplified)
        const catchRate = 0.5;
        const isCaught = Math.random() < catchRate;

        if (isCaught) {
            this.add('-activate', target, 'shake3'); // Visual indicator
            this.add('|message|Gotcha! ' + target.name + ' was caught!');
            this.win(source.side.name); // P1 wins by catching
            return null;
        } else {
            this.add('-activate', target, 'shake1');
            this.add('|message|Oh no! The PubMon broke free!');
            return false; // Turn wasted, opponent attacks now
        }
    },
    secondary: null,
    target: "normal",
    type: "Water",
};

	let moveCounter = 1000; // Start custom moves at a high ID to avoid collisions

	// Get Gen 1 Dex for cloning move properties
	const gen1Dex = Dex.forGen(1);

	ALL_PUBMON.forEach((mon) => {
		// Convert name to an ID (lowercase, alphanumeric only)
		const speciesId = mon.name.toLowerCase().replace(/[^a-z0-9]+/g, "");

		// Build learnset from the mon's moves
		const learnset: Record<string, string[]> = {};
		mon.moves.forEach((moveName) => {
			const moveId = moveName.toLowerCase().replace(/[^a-z0-9]+/g, "");
			learnset[moveId] = ["8L1"]; // Learn at level 1 in generation 8
		});

		// Create the Species entry
		Species[speciesId] = {
			inherit: false,
			num: mon.id,
			name: mon.name,
			types: [PUBMON_TYPE_MAP[mon.type]],
			baseStats: {
				hp: mon.maxHp,
				atk: mon.attack,
				def: mon.defense,
				spa: mon.attack, // Mirrored for Gen 1 'Special' calc
				spd: mon.defense, // Mirrored for Gen 1 'Special' calc
				spe: 50, // Arbitrary default speed so they can take turns
			},
			weightkg: 10, // Arbitrary weight
			abilities: { 0: "No Ability" }, // Gen 1 didn't have abilities
			learnset,
		};

		// Create custom move entries by cloning Gen 1 base moves
		mon.moves.forEach((moveName) => {
			const moveId = moveName.toLowerCase().replace(/[^a-z0-9]+/g, "");

			if (!Moves[moveId]) {
				// Lookup the base Gen 1 move from the mapping
				const baseMoveId = MOVE_MAPPINGS[moveId] || "tackle"; // Default to Tackle if no mapping found
				const baseMove = gen1Dex.moves.get(baseMoveId);

				if (baseMove && baseMove.exists) {
					// Clone all properties from the base Gen 1 move
					Moves[moveId] = {
						inherit: false,
						num: moveCounter++,
						name: moveName, // Override with custom name
						// Clone core properties from Gen 1 base
						basePower: baseMove.basePower,
						accuracy: baseMove.accuracy,
						pp: baseMove.pp,
						type: baseMove.type,
						category: baseMove.category,
						priority: baseMove.priority,
						target: baseMove.target,
						// Clone flags and secondary effects if present
						...(baseMove.flags && { flags: { ...baseMove.flags } }),
						...(baseMove.secondary && { secondary: { ...baseMove.secondary } }),
						...(baseMove.secondaries && {
							secondaries: baseMove.secondaries.map((s: any) => ({ ...s })),
						}),
						...(baseMove.recoil && { recoil: baseMove.recoil }),
						...(baseMove.drain && { drain: baseMove.drain }),
						...(baseMove.multihit && { multihit: baseMove.multihit }),
						...(baseMove.volatileStatus && {
							volatileStatus: baseMove.volatileStatus,
						}),
						...(baseMove.status && { status: baseMove.status }),
						...(baseMove.boosts && { boosts: { ...baseMove.boosts } }),
						...(baseMove.self && { self: { ...baseMove.self } }),
					};
				} else {
					// Fallback to a basic stub if base move not found
					console.warn(
						`Base move '${baseMoveId}' not found for custom move '${moveName}', using default stub`,
					);
					Moves[moveId] = {
						inherit: false,
						num: moveCounter++,
						name: moveName,
						basePower: 50,
						type: PUBMON_TYPE_MAP[mon.type],
						category: "Physical",
						accuracy: 100,
						pp: 15,
						target: "normal",
					};
				}
			}
		});
	});

	return {
		Scripts: { inherit: "gen1" },
		Species,
		Moves,
		Formats: [
			{
				id: "gen1pubmon",
				inherit: false,
				effectType: "Format",
				name: "Gen 1 PubMon",
				mod: "pubmon",
				ruleset: ["Standard"],
			},
		],
	} as ModData;
}
