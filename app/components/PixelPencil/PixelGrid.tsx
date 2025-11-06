import {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
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
  drawValueVersion: number;
  tool: string;
  wrapperMaxWidth: number;
  wrapperMaxHeight: number;
  handlePointerDown: (
    event: ReactPointerEvent<HTMLCanvasElement>,
    index: number,
  ) => void;
  handlePointerEnter: (
    event: ReactPointerEvent<HTMLCanvasElement>,
    index: number,
  ) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
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
  drawValueVersion,
}: PixelGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverIndexRef = useRef<number | null>(null);

  const canvasDisplayWidth = Math.max(1, gridWidth * displayCellSize);
  const canvasDisplayHeight = Math.max(1, gridHeight * displayCellSize);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    if (gridWidth <= 0 || gridHeight <= 0 || displayCellSize <= 0) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const devicePixelRatio =
      typeof window === "undefined" ? 1 : window.devicePixelRatio ?? 1;

    const width = gridWidth * displayCellSize;
    const height = gridHeight * displayCellSize;

    canvas.width = Math.max(1, Math.floor(width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(height * devicePixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const previewColor = drawValueRef.current;

    for (let index = 0; index < pixels.length; index += 1) {
      const pixel = pixels[index];
      const { x, y } = indexToCoords(index);
      const cellX = x * displayCellSize;
      const cellY = y * displayCellSize;
      const isTransparent = pixel === null || pixel === "transparent";
      const patternColor =
        (x + y) % 2 === 0 ? TRANSPARENT_LIGHT : TRANSPARENT_DARK;
      const fillColor = isTransparent ? patternColor : (pixel as PaletteColor);
      const isPathPreviewCell = pathPreview?.has(index) ?? false;
      const showPathPreview = previewToolEffects && isPathPreviewCell;
      const previewValue = showPathPreview ? previewColor : null;
      const previewFillColor =
        previewValue === null || previewValue === "transparent"
          ? patternColor
          : (previewValue as PaletteColor);
      const cellBackgroundColor = showPathPreview ? previewFillColor : fillColor;

      let opacity = 1;
      if (tool === "bucket") {
        opacity = bucketPreview?.has(index) ? 0.7 : 1;
      } else if (showPathPreview) {
        opacity = 0.7;
      } else if (brushPreview?.has(index)) {
        opacity = 0.7;
      }

      context.globalAlpha = opacity;
      context.fillStyle = cellBackgroundColor;
      context.fillRect(cellX, cellY, displayCellSize, displayCellSize);
    }

    context.globalAlpha = 1;

    if (showPixelGrid) {
      context.strokeStyle = "rgba(228, 228, 231, 0.8)";
      context.lineWidth = 1;
      for (let column = 0; column <= gridWidth; column += 1) {
        const x = column * displayCellSize + 0.5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let row = 0; row <= gridHeight; row += 1) {
        const y = row * displayCellSize + 0.5;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
    }
  }, [
    brushPreview,
    bucketPreview,
    displayCellSize,
    drawValueRef,
    gridHeight,
    gridWidth,
    indexToCoords,
    pathPreview,
    pixels,
    previewToolEffects,
    showPixelGrid,
    tool,
    drawValueVersion,
  ]);

  const resolveCellIndex = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || displayCellSize <= 0) return null;
      const rect = canvas.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      const relativeY = event.clientY - rect.top;
      const cellX = Math.floor(relativeX / displayCellSize);
      const cellY = Math.floor(relativeY / displayCellSize);
      if (
        cellX < 0 ||
        cellY < 0 ||
        cellX >= gridWidth ||
        cellY >= gridHeight
      ) {
        return null;
      }
      return cellY * gridWidth + cellX;
    },
    [displayCellSize, gridHeight, gridWidth],
  );

  const emitPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>, index: number | null) => {
      if (index === null) {
        if (hoverIndexRef.current !== null) {
          hoverIndexRef.current = null;
          handlePointerLeave();
        }
        return;
      }
      if (hoverIndexRef.current === index) {
        return;
      }
      hoverIndexRef.current = index;
      handlePointerEnter(event, index);
    },
    [handlePointerEnter, handlePointerLeave],
  );

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const index = resolveCellIndex(event);
      if (index === null) return;
      hoverIndexRef.current = index;
      handlePointerDown(event, index);
    },
    [handlePointerDown, resolveCellIndex],
  );

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      handlePointerMove(event);
      const index = resolveCellIndex(event);
      emitPointerEnter(event, index);
    },
    [emitPointerEnter, handlePointerMove, resolveCellIndex],
  );

  const handleCanvasPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const index = resolveCellIndex(event);
      emitPointerEnter(event, index);
    },
    [emitPointerEnter, resolveCellIndex],
  );

  const handleCanvasPointerLeave = useCallback(() => {
    hoverIndexRef.current = null;
    handlePointerLeave();
  }, [handlePointerLeave]);

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
        className={`h-full rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${
          zoomScale > 1 ? "min-w-max" : "mx-auto max-w-full"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="block touch-none select-none focus:outline-none"
          width={canvasDisplayWidth}
          height={canvasDisplayHeight}
          style={{
            width: `${canvasDisplayWidth}px`,
            height: `${canvasDisplayHeight}px`,
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={handleCanvasPointerEnter}
          onPointerLeave={handleCanvasPointerLeave}
        />
      </div>
    </div>
  );
}
