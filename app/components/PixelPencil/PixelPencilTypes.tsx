export interface PaintTool {
  id: string;
  label: string;
  icon: string;
  settings: {
    brushSize?: boolean;
    brushShape?: boolean;
    paletteTheme?: boolean;
    palette?: boolean;
  };
}

export interface PaletteTheme {
  id: string;
  name: string;
  colors: readonly string[];
}
