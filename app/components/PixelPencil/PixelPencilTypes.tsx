export interface PaintTool {
  id: string;
  label: string;
  icon: string;
}

export interface PaletteTheme {
  id: string;
  name: string;
  colors: readonly string[];
}