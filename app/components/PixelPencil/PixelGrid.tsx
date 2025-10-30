import { MutableRefObject, RefObject, useMemo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  TRANSPARENT_DARK,
  TRANSPARENT_LIGHT,
} from "./PixelPencil.constants";
import { PaletteColor, PixelValue } from "./PixelPencilTypes";

interface PixelGridProps {
  gridWidth: number;
  gridHeight: number;
  displayCellSize: number;
  zoomScale: number;
  gridWrapperRef: RefObject<HTMLDivElement | null>;
  gridRef: RefObject<HTMLDivElement | null>;
  pixels: PixelValue[];
  indexToCoords: (index: number) => { x: number; y: number };
  showPixelGrid: boolean;
  previewToolEffects: boolean;
  bucketPreview: Set<number> | null;
  brushPreview: Set<number> | null;
  pathPreview: Set<number> | null;
  drawValueRef: MutableRefObject<PixelValue>;
  tool: string;
  wrapperMaxWidth: number;
  wrapperMaxHeight: number;
  handlePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) => void;
  handlePointerEnter: (
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  handlePointerLeave: () => void;
}

export function PixelGrid({
  gridWidth,
  gridHeight,
  displayCellSize,
  zoomScale,
  gridWrapperRef,
  gridRef,
  pixels,
  indexToCoords,
  showPixelGrid,
  previewToolEffects,
  bucketPreview,
  brushPreview,
  pathPreview,
  drawValueRef,
  tool,
  wrapperMaxWidth,
  wrapperMaxHeight,
  handlePointerDown,
  handlePointerEnter,
  handlePointerMove,
  handlePointerUp,
  handlePointerLeave,
}: PixelGridProps) {
  const cells = useMemo(
    () =>
      pixels.map((pixel, index) => {
        const { x, y } = indexToCoords(index);
        const key = `${x}-${y}`;
        const isTransparent = pixel === null || pixel === "transparent";
        const patternColor =
          (x + y) % 2 === 0 ? TRANSPARENT_LIGHT : TRANSPARENT_DARK;
        const fillColor = isTransparent ? patternColor : (pixel as PaletteColor);
        const isPathPreviewCell = pathPreview?.has(index) ?? false;
        const showPathPreview = previewToolEffects && isPathPreviewCell;
        const borderClasses = showPixelGrid
          ? "border border-zinc-200 dark:border-zinc-700"
          : "border border-transparent dark:border-transparent";
        const previewValue = showPathPreview ? drawValueRef.current : null;
        const previewFillColor =
          previewValue === null || previewValue === "transparent"
            ? patternColor
            : (previewValue as PaletteColor);
        const cellBackgroundColor = showPathPreview ? previewFillColor : fillColor;
        return (
          <button
            key={key}
            type="button"
            className={`relative ${borderClasses} touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white dark:focus-visible:ring-offset-black`}
            style={{
              width: `${displayCellSize}px`,
              height: `${displayCellSize}px`,
              backgroundColor: cellBackgroundColor,
              opacity:
                tool === "bucket"
                  ? bucketPreview?.has(index)
                    ? 0.7
                    : 1
                  : showPathPreview
                    ? 0.7
                    : brushPreview?.has(index)
                      ? 0.7
                      : 1,
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => handlePointerDown(event, index)}
            onPointerEnter={(event) => handlePointerEnter(event, index)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          />
        );
      }),
    [
      brushPreview,
      bucketPreview,
      displayCellSize,
      drawValueRef,
      handlePointerDown,
      handlePointerEnter,
      handlePointerLeave,
      handlePointerMove,
      handlePointerUp,
      indexToCoords,
      pathPreview,
      pixels,
      previewToolEffects,
      showPixelGrid,
      tool,
    ],
  );

  return (
    <div
      ref={gridWrapperRef}
      className={`max-h-min touch-none h-min ${
        zoomScale > 1
          ? "overflow-auto"
          : "flex justify-center overflow-hidden"
      }`}
      style={{
        maxWidth: wrapperMaxWidth > 0 ? `${wrapperMaxWidth}px` : undefined,
        width: "100%",
        height: wrapperMaxHeight > 0 ? `${wrapperMaxHeight}px` : undefined,
      }}
    >
      <div
        ref={gridRef}
        className={`h-full grid rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${
          zoomScale > 1 ? "min-w-max" : "mx-auto max-w-full"
        }`}
        style={{
          gridTemplateColumns: `repeat(${gridWidth}, ${displayCellSize}px)`,
          gridTemplateRows: `repeat(${gridHeight}, ${displayCellSize}px)`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
