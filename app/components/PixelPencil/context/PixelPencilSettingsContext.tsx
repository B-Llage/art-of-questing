"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type CanvasPixelSizeOption = 8 | 13 | 16 | 19 | 32;
type GridDimensionOption = 16 | 32 | 64 | 128 | 256;

interface PixelPencilSettingsContextValue {
  previewToolEffects: boolean;
  setPreviewToolEffects: Dispatch<SetStateAction<boolean>>;
  canvasPixelSize: CanvasPixelSizeOption;
  setCanvasPixelSize: Dispatch<SetStateAction<CanvasPixelSizeOption>>;
  gridWidth: GridDimensionOption;
  gridHeight: GridDimensionOption;
  setGridWidth: Dispatch<SetStateAction<GridDimensionOption>>;
  setGridHeight: Dispatch<SetStateAction<GridDimensionOption>>;
  showPixelGrid: boolean;
  setShowPixelGrid: Dispatch<SetStateAction<boolean>>;
}

const PixelPencilSettingsContext =
  createContext<PixelPencilSettingsContextValue | null>(null);

export function PixelPencilSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [previewToolEffects, setPreviewToolEffects] = useState(true);
  const [canvasPixelSize, setCanvasPixelSize] =
    useState<CanvasPixelSizeOption>(8);
  const [gridWidth, setGridWidth] = useState<GridDimensionOption>(32);
  const [gridHeight, setGridHeight] = useState<GridDimensionOption>(32);
  const [showPixelGrid, setShowPixelGrid] = useState(false);

  const value = useMemo(
    () => ({
      previewToolEffects,
      setPreviewToolEffects,
      canvasPixelSize,
      setCanvasPixelSize,
      gridWidth,
      gridHeight,
      setGridWidth,
      setGridHeight,
      showPixelGrid,
      setShowPixelGrid,
    }),
    [
      previewToolEffects,
      canvasPixelSize,
      gridWidth,
      gridHeight,
      showPixelGrid,
    ],
  );

  return (
    <PixelPencilSettingsContext.Provider value={value}>
      {children}
    </PixelPencilSettingsContext.Provider>
  );
}

export function usePixelPencilSettings() {
  const context = useContext(PixelPencilSettingsContext);
  if (!context) {
    throw new Error(
      "usePixelPencilSettings must be used within a PixelPencilSettingsProvider",
    );
  }
  return context;
}

export const CANVAS_PIXEL_SIZE_OPTIONS: ReadonlyArray<CanvasPixelSizeOption> = [
  8,
  13,
  16,
  19,
  32,
] as const;

export const GRID_DIMENSION_OPTIONS: ReadonlyArray<GridDimensionOption> = [
  16,
  32,
  64,
  128,
  256
] as const;
