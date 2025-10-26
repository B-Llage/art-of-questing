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

type CanvasPixelSizeOption = 13 | 16 | 19;

interface PixelPencilSettingsContextValue {
  previewToolEffects: boolean;
  setPreviewToolEffects: Dispatch<SetStateAction<boolean>>;
  canvasPixelSize: CanvasPixelSizeOption;
  setCanvasPixelSize: Dispatch<SetStateAction<CanvasPixelSizeOption>>;
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
    useState<CanvasPixelSizeOption>(16);

  const value = useMemo(
    () => ({
      previewToolEffects,
      setPreviewToolEffects,
      canvasPixelSize,
      setCanvasPixelSize,
    }),
    [previewToolEffects, canvasPixelSize],
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
  13,
  16,
  19,
] as const;
