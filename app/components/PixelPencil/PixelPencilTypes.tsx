import { BRUSH_SHAPES, SHAPE_TYPES } from "./PixelPencil.constants";

export interface PaintTool {
  id: string;
  label: string;
  icon: string;
  hotkey?: string;
  settings: {
    brushSize?: boolean;
    brushShape?: boolean;
    paletteTheme?: boolean;
    palette?: boolean;
    selectedColor?: boolean;
    shapeType?: boolean;
    shapeFilled?: boolean;
    zoomMode?: boolean;
  };
}

export interface PaletteTheme {
  id: string;
  name: string;
  colors: readonly string[];
}

export type PaletteColor = string | "transparent";
export type PixelValue = PaletteColor | null;

export type BrushShape = (typeof BRUSH_SHAPES)[number]["id"];
export type ShapeKind = (typeof SHAPE_TYPES)[number]["id"];
