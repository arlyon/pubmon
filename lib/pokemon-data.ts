export type PubType = "beer" | "shot" | "wine" | "water" | "cocktail"

export interface PubMon {
  id: number
  name: string
  type: PubType
  hp: number
  maxHp: number
  level: number
  xp: number
  attack: number
  defense: number
  moves: string[]
  sprite: string // pixel art character represented as CSS
  description: string
}

export const TYPE_INFO: Record<PubType, { label: string; element: string; color: string; bgColor: string }> = {
  beer: { label: "Beer", element: "Earth", color: "#c28b4a", bgColor: "#3d2c14" },
  shot: { label: "Shot", element: "Fire", color: "#e43b44", bgColor: "#3d1418" },
  wine: { label: "Wine", element: "Fairy", color: "#f4a4c0", bgColor: "#3d1a2a" },
  water: { label: "Water", element: "Water", color: "#63c6e1", bgColor: "#142a3d" },
  cocktail: { label: "Cocktail", element: "Grass", color: "#63c74d", bgColor: "#1a3d14" },
}

export const ALL_PUBMON: PubMon[] = [
  // Beer (Earth)
  {
    id: 1, name: "Hoppsin", type: "beer", hp: 45, maxHp: 45, level: 5, xp: 0,
    attack: 12, defense: 10,
    moves: ["Grain Slam", "Foam Burst", "Barrel Roll", "Yeast Punch"],
    sprite: "hoppsin",
    description: "A hoppy creature born from the finest barley fields. Its foam mane bristles when angered.",
  },
  {
    id: 2, name: "Lagerite", type: "beer", hp: 52, maxHp: 52, level: 5, xp: 0,
    attack: 10, defense: 14,
    moves: ["Cold Snap", "Golden Pour", "Barrel Roll", "Malt Shield"],
    sprite: "lagerite",
    description: "A smooth, golden creature that thrives in cool cellars. Calm and collected in battle.",
  },
  // Shot (Fire)
  {
    id: 3, name: "Absintile", type: "shot", hp: 38, maxHp: 38, level: 5, xp: 0,
    attack: 16, defense: 7,
    moves: ["Green Flame", "Wormwood Hex", "Spirit Burn", "Louche Flash"],
    sprite: "absintile",
    description: "A mysterious green spirit wreathed in ethereal flames. Its gaze induces hallucinations.",
  },
  {
    id: 4, name: "Tequilar", type: "shot", hp: 40, maxHp: 40, level: 5, xp: 0,
    attack: 15, defense: 8,
    moves: ["Agave Blaze", "Salt Sting", "Lime Slash", "Sunrise Burst"],
    sprite: "tequilar",
    description: "A fiery desert dweller with crystalline salt armor. Attacks with citrus precision.",
  },
  {
    id: 5, name: "Cazcabella", type: "shot", hp: 42, maxHp: 42, level: 5, xp: 0,
    attack: 14, defense: 9,
    moves: ["Ember Shot", "Mezcal Smoke", "Fire Ring", "Pepper Blast"],
    sprite: "cazcabella",
    description: "A smoky, elegant fire-type with rings of flame orbiting its body.",
  },
  // Wine (Fairy)
  {
    id: 6, name: "Charderan", type: "wine", hp: 44, maxHp: 44, level: 5, xp: 0,
    attack: 11, defense: 12,
    moves: ["Oak Charm", "Vintage Heal", "Grape Whip", "Sommelier's Touch"],
    sprite: "charderan",
    description: "An elegant fairy-type aged to perfection. Its aroma calms even the fiercest foes.",
  },
  {
    id: 7, name: "Merlot", type: "wine", hp: 48, maxHp: 48, level: 5, xp: 0,
    attack: 13, defense: 11,
    moves: ["Ruby Beam", "Tannin Shield", "Decant Dance", "Cork Pop"],
    sprite: "merlot",
    description: "A deep ruby creature with velvety fur. Its body sparkles with fairy dust.",
  },
  // Water
  {
    id: 8, name: "Springer", type: "water", hp: 50, maxHp: 50, level: 5, xp: 0,
    attack: 10, defense: 13,
    moves: ["Spring Gush", "Purity Shield", "Aqua Jet", "Mineral Heal"],
    sprite: "springer",
    description: "A crystal-clear water spirit from mountain springs. Purest of all PubMon.",
  },
  {
    id: 9, name: "Stillbar", type: "water", hp: 46, maxHp: 46, level: 5, xp: 0,
    attack: 9, defense: 15,
    moves: ["Still Calm", "Deep Current", "Aqua Wall", "Cleanse Wave"],
    sprite: "stillbar",
    description: "A tranquil water guardian. Its still surface hides incredible defensive power.",
  },
  {
    id: 10, name: "Sparklid", type: "water", hp: 42, maxHp: 42, level: 5, xp: 0,
    attack: 12, defense: 11,
    moves: ["Bubble Burst", "Fizz Attack", "Carbonation", "Sparkle Shot"],
    sprite: "sparklid",
    description: "A bubbly, energetic creature covered in effervescent orbs.",
  },
  {
    id: 11, name: "Tonica", type: "water", hp: 44, maxHp: 44, level: 5, xp: 0,
    attack: 11, defense: 12,
    moves: ["Quinine Blast", "Bitter Spray", "Tonic Wave", "Citrus Guard"],
    sprite: "tonica",
    description: "A bitter-sweet water creature with a distinctive glow under UV light.",
  },
  // Cocktail (Grass)
  {
    id: 12, name: "Martini", type: "cocktail", hp: 40, maxHp: 40, level: 5, xp: 0,
    attack: 14, defense: 10,
    moves: ["Olive Toss", "Shaken Strike", "Vermouth Vine", "Garnish Guard"],
    sprite: "martini",
    description: "A suave grass-type with a crystal-clear body and a single olive antenna.",
  },
  {
    id: 13, name: "Aperol", type: "cocktail", hp: 43, maxHp: 43, level: 5, xp: 0,
    attack: 13, defense: 11,
    moves: ["Spritz Shower", "Bitter Bloom", "Orange Slice", "Sunset Beam"],
    sprite: "aperol",
    description: "An orange-tinted grass creature that blooms at golden hour.",
  },
  {
    id: 14, name: "Caiprinha", type: "cocktail", hp: 41, maxHp: 41, level: 5, xp: 0,
    attack: 15, defense: 9,
    moves: ["Lime Crush", "Sugar Rush", "Muddle Smash", "Tropical Gale"],
    sprite: "caiprinha",
    description: "A tropical grass warrior with lime-green armor. Fights with raw, muddled power.",
  },
]

export function getRandomPubMon(type: PubType): PubMon {
  const pool = ALL_PUBMON.filter(p => p.type === type)
  const selected = pool[Math.floor(Math.random() * pool.length)]
  return { ...selected, hp: selected.maxHp }
}
