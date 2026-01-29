"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type CanvasPixelSizeOption = 8 | 13 | 16 | 19 | 32;
type GridDimensionOption = 16 | 32 | 64 | 128 | 256;
type CheckerSizeOption = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
  checkerSize: CheckerSizeOption;
  setCheckerSize: Dispatch<SetStateAction<CheckerSizeOption>>;
}

const STORAGE_KEY = "pixel-pencil-settings";

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
  const [checkerSize, setCheckerSize] = useState<CheckerSizeOption>(8);

  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        previewToolEffects: boolean;
        canvasPixelSize: CanvasPixelSizeOption;
        gridWidth: GridDimensionOption;
        gridHeight: GridDimensionOption;
        showPixelGrid: boolean;
        checkerSize: CheckerSizeOption;
      }>;
      if (typeof parsed.previewToolEffects === "boolean") {
        setPreviewToolEffects(parsed.previewToolEffects);
      }
      if (
        parsed.canvasPixelSize &&
        (CANVAS_PIXEL_SIZE_OPTIONS as readonly number[]).includes(
          parsed.canvasPixelSize,
        )
      ) {
        setCanvasPixelSize(parsed.canvasPixelSize);
      }
      if (
        parsed.gridWidth &&
        (GRID_DIMENSION_OPTIONS as readonly number[]).includes(
          parsed.gridWidth,
        )
      ) {
        setGridWidth(parsed.gridWidth);
      }
      if (
        parsed.gridHeight &&
        (GRID_DIMENSION_OPTIONS as readonly number[]).includes(
          parsed.gridHeight,
        )
      ) {
        setGridHeight(parsed.gridHeight);
      }
      if (typeof parsed.showPixelGrid === "boolean") {
        setShowPixelGrid(parsed.showPixelGrid);
      }
      if (
        parsed.checkerSize &&
        (CHECKER_SIZE_OPTIONS as readonly number[]).includes(parsed.checkerSize)
      ) {
        setCheckerSize(parsed.checkerSize);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({
      previewToolEffects,
      canvasPixelSize,
      gridWidth,
      gridHeight,
      showPixelGrid,
      checkerSize,
    });
    window.localStorage.setItem(STORAGE_KEY, payload);
  }, [
    previewToolEffects,
    canvasPixelSize,
    gridWidth,
    gridHeight,
    showPixelGrid,
    checkerSize,
  ]);

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
      checkerSize,
      setCheckerSize,
    }),
    [
      previewToolEffects,
      canvasPixelSize,
      gridWidth,
      gridHeight,
      showPixelGrid,
      checkerSize,
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

export const CHECKER_SIZE_OPTIONS: ReadonlyArray<CheckerSizeOption> = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
] as const;
