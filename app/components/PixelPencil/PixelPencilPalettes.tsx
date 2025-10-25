import { PaletteTheme } from "./PixelPencilTypes";

const BasicPalette: PaletteTheme = {
    id: "basic",
    name: "Basic",
    colors: [
        "#000000",
        "#1f2937",
        "#312e81",
        "#f97316",
        "#f59e0b",
        "#84cc16",
        "#0ea5e9",
        "#6366f1",
        "#ffffff",
    ],
}

const FirePalette: PaletteTheme =
{
    id: "fire",
    name: "Fire",
    colors: [
        "#1f2937",
        "#ef4444",
        "#f97316",
        "#fbbf24",
        "#b91c1c",
        "#7f1d1d",
        "#fb7185",
        "#facc15",
        "#ea580c",
    ],
};

const PoisonPalette: PaletteTheme =
{
    id: "poison",
    name: "Poison",
    colors: [
        "#312e81",
        "#14532d",
        "#16a34a",
        "#22c55e",
        "#bbf7d0",
        "#111827",
        "#7c3aed",
        "#a855f7",
        "#c084fc",
    ],
};

const IcePalette: PaletteTheme = {
    id: "ice",
    name: "Ice",
    colors: [
        "#082f49",
        "#0e7490",
        "#22d3ee",
        "#38bdf8",
        "#bae6fd",
        "#f8fafc",
        "#1e293b",
        "#60a5fa",
        "#2563eb",
    ],
};

const GameBoyPalette: PaletteTheme =
{
    id: "gameboy",
    name: "Game Boy",
    colors: [
        "#0f380f",
        "#306230",
        "#8bac0f",
        "#9bbc0f",
        "#c4d1be",
        "#1c1c1c",
        "#4a644a",
        "#94aa2a",
        "#c6de5a",
    ],
};

const NESPalette: PaletteTheme =
{
    id: "nes",
    name: "NES",
    colors: [
        "#211e20",
        "#ffffff",
        "#d04648",
        "#f7d7c4",
        "#2f8fdd",
        "#f8b800",
        "#7765c6",
        "#c84c0c",
        "#94e089",
    ],
};

const VirtualBoyPalette: PaletteTheme =
{
    id: "virtualboy",
    name: "Virtual Boy",
    colors: [
      "#10000f",
      "#1f001f",
      "#330033",
      "#4c004c",
      "#660066",
      "#990099",
      "#cc00cc",
      "#ff00ff",
      "#ff1a8c",
    ],
  };
  
export const PixelPencilPalettes: PaletteTheme[] = [
    BasicPalette,
    FirePalette,
    PoisonPalette,
    IcePalette,
    GameBoyPalette,
    NESPalette,
    VirtualBoyPalette,
];
