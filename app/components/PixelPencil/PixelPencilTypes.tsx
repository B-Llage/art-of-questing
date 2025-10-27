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
