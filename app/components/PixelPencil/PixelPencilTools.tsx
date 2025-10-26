import { PaintTool } from "./PixelPencilTypes";

export const PencilTool: PaintTool = {
  id: "pencil",
  label: "Pencil",
  icon: "/icons/tools/Pencil.png",
  settings: {
    brushSize: true,
    brushShape: true,
    paletteTheme: true,
    palette: true,
    selectedColor: true,
  },
  hotkey: "q",
};

export const LineTool: PaintTool = {
  id: "line",
  label: "Line",
  icon: "/icons/tools/Line.png",
  settings: {
    brushSize: true,
    brushShape: true,
    paletteTheme: true,
    palette: true,
    selectedColor: true,
  },
  hotkey: "l",
};

export const ShapeTool: PaintTool = {
  id: "shape",
  label: "Shape",
  icon: "/icons/tools/Shape.png",
  settings: {
    brushSize: true,
    shapeType: true,
    paletteTheme: true,
    palette: true,
    selectedColor: true,
  },
  hotkey: "s",
};

export const ColorPickerTool: PaintTool = {
  id: "picker",
  label: "Picker",
  icon: "/icons/tools/ColorPicker.png",
  settings: {
    selectedColor: true,
  },
  hotkey: "e",
};

export const BucketTool: PaintTool = {
  id: "bucket",
  label: "Bucket",
  icon: "/icons/tools/Bucket.png",
  settings: {
    paletteTheme: true,
    palette: true,
    selectedColor: true,
  },
  hotkey: "g",
};

export const EraserTool: PaintTool = {
  id: "eraser",
  label: "Eraser",
  icon: "/icons/tools/Eraser.png",
  settings: {
    brushSize: true,
    brushShape: true,
    selectedColor: true,
  },
  hotkey: "w",
};
