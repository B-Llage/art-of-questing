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
};

export const ColorPickerTool: PaintTool = {
  id: "picker",
  label: "Picker",
  icon: "/icons/tools/ColorPicker.png",
  settings: {
    selectedColor: true,
  },
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
};
