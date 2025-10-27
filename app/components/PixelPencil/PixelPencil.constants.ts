export const TRANSPARENT_LIGHT = "#d4d4d8";
export const TRANSPARENT_DARK = "#9ca3af";

export const MAX_HISTORY = 15;

export const BRUSH_SIZES = [1, 2, 3] as const;
export const EXPORT_SCALES = [1, 2, 3] as const;
export const MAX_ZOOM_SCALE = 5;

export const BRUSH_SHAPES = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
] as const;

export const SHAPE_TYPES = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "triangle", label: "Triangle" },
] as const;
