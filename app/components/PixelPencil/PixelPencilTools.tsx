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
  },
};

export const BucketTool: PaintTool = {
  id: "bucket",
  label: "Bucket",
  icon: "/icons/tools/Bucket.png",
  settings: {
    paletteTheme: true,
    palette: true,
  },
};

export const EraserTool: PaintTool = {
  id: "eraser",
  label: "Eraser",
  icon: "/icons/tools/Eraser.png",
  settings: {
    brushSize: true,
    brushShape: true,
  },
};
