import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";

import {
  TRANSPARENT_DARK,
  TRANSPARENT_LIGHT,
} from "./PixelPencil.constants";
import { PaletteColor, PixelValue } from "./PixelPencilTypes";

interface PixelGridProps {
  gridWidth: number;
  gridHeight: number;
  displayCellSize: number;
  gridWrapperRef: MutableRefObject<HTMLDivElement | null>;
  gridRef: MutableRefObject<HTMLCanvasElement | null>;
  pixels: PixelValue[];
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
  canvasScroll: { x: number; y: number };
  onScrollChange: (scroll: { x: number; y: number }) => void;
  onViewportResize: (size: { width: number; height: number }) => void;
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
const MIN_SCROLLBAR_SIZE = 24;
const VERTICAL_TRACK_MARGIN = 37;
const HORIZONTAL_TRACK_MARGIN = 37;
const VERTICAL_HANDLE_PADDING = 0;
const HORIZONTAL_HANDLE_PADDING = 0;

export function PixelGrid({
  gridWidth,
  gridHeight,
  displayCellSize,
  gridWrapperRef,
  gridRef,
  pixels,
  showPixelGrid,
  previewToolEffects,
  bucketPreview,
  brushPreview,
  pathPreview,
  drawValueRef,
  tool,
  wrapperMaxWidth,
  wrapperMaxHeight,
  canvasScroll,
  onScrollChange,
  onViewportResize,
  handlePointerDown,
  handlePointerEnter,
  handlePointerMove,
  handlePointerUp,
  handlePointerLeave,
  drawValueVersion,
}: PixelGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const contentWidth = Math.max(0, gridWidth * displayCellSize);
  const contentHeight = Math.max(0, gridHeight * displayCellSize);
  const maxScrollX = Math.max(0, contentWidth - viewport.width);
  const maxScrollY = Math.max(0, contentHeight - viewport.height);
  const needsHorizontalCenter =
    viewport.width > 0 && contentWidth > 0 && contentWidth <= viewport.width;
  const needsVerticalCenter =
    viewport.height > 0 && contentHeight > 0 && contentHeight <= viewport.height;
  const scrollOriginX = needsHorizontalCenter ? 0 : canvasScroll.x;
  const scrollOriginY = needsVerticalCenter ? 0 : canvasScroll.y;
  const renderOffsetX = needsHorizontalCenter
    ? (viewport.width - contentWidth) / 2
    : 0;
  const renderOffsetY = needsVerticalCenter
    ? (viewport.height - contentHeight) / 2
    : 0;

  const assignCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      gridRef.current = node;
    },
    [gridRef],
  );

  useEffect(() => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    const updateViewport = () => {
      const width = Math.max(
        0,
        wrapper.clientWidth,
      );
      const height = Math.max(
        0,
        wrapper.clientHeight,
      );
      setViewport((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
      onViewportResize({ width, height });
    };
    updateViewport();
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, [gridWrapperRef, onViewportResize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (
      gridWidth <= 0 ||
      gridHeight <= 0 ||
      displayCellSize <= 0 ||
      viewport.width <= 0 ||
      viewport.height <= 0
    ) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) return;

    const devicePixelRatio =
      typeof window === "undefined" ? 1 : window.devicePixelRatio ?? 1;

    const viewportWidth = Math.max(1, viewport.width);
    const viewportHeight = Math.max(1, viewport.height);
    canvas.width = Math.max(1, Math.floor(viewportWidth * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(viewportHeight * devicePixelRatio));
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, viewportWidth, viewportHeight);

    const previewColor = drawValueRef.current;
    const startX = Math.max(0, Math.floor(scrollOriginX / displayCellSize));
    const endX = Math.min(
      gridWidth,
      Math.ceil((scrollOriginX + viewportWidth) / displayCellSize) + 1,
    );
    const startY = Math.max(0, Math.floor(scrollOriginY / displayCellSize));
    const endY = Math.min(
      gridHeight,
      Math.ceil((scrollOriginY + viewportHeight) / displayCellSize) + 1,
    );

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const cellX =
          x * displayCellSize - scrollOriginX + renderOffsetX;
        const cellY =
          y * displayCellSize - scrollOriginY + renderOffsetY;
        if (cellX + displayCellSize < 0 || cellY + displayCellSize < 0) continue;
        if (cellX > viewportWidth || cellY > viewportHeight) continue;

        const index = y * gridWidth + x;
        const pixel = pixels[index];
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
    }

    context.globalAlpha = 1;

    if (showPixelGrid) {
      context.strokeStyle = "rgba(228, 228, 231, 0.8)";
      context.lineWidth = 1;
      for (let column = startX; column <= endX; column += 1) {
        const x =
          column * displayCellSize - scrollOriginX + renderOffsetX + 0.5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, viewportHeight);
        context.stroke();
      }
      for (let row = startY; row <= endY; row += 1) {
        const y =
          row * displayCellSize - scrollOriginY + renderOffsetY + 0.5;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(viewportWidth, y);
        context.stroke();
      }
    }
  }, [
    brushPreview,
    bucketPreview,
    canvasScroll.x,
    canvasScroll.y,
    displayCellSize,
    drawValueRef,
    gridHeight,
    gridWidth,
    pathPreview,
    pixels,
    previewToolEffects,
    showPixelGrid,
    tool,
    viewport.height,
    renderOffsetX,
    renderOffsetY,
    scrollOriginX,
    scrollOriginY,
    viewport.width,
    drawValueVersion,
  ]);

  const resolveCellIndex = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || displayCellSize <= 0) return null;
      const rect = canvas.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      const relativeY = event.clientY - rect.top;
      const minX = renderOffsetX;
      const minY = renderOffsetY;
      const maxX = renderOffsetX + contentWidth;
      const maxY = renderOffsetY + contentHeight;
      if (
        relativeX < minX ||
        relativeY < minY ||
        relativeX > maxX ||
        relativeY > maxY
      ) {
        return null;
      }
      const offsetAdjustedX = relativeX - renderOffsetX;
      const offsetAdjustedY = relativeY - renderOffsetY;
      const worldX = scrollOriginX + offsetAdjustedX;
      const worldY = scrollOriginY + offsetAdjustedY;
      const cellX = Math.floor(worldX / displayCellSize);
      const cellY = Math.floor(worldY / displayCellSize);
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
    [
      contentHeight,
      contentWidth,
      displayCellSize,
      gridHeight,
      gridWidth,
      renderOffsetX,
      renderOffsetY,
      scrollOriginX,
      scrollOriginY,
    ],
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

  const handleCanvasWheel = useCallback(
    (event: ReactWheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const proposedX = canvasScroll.x + event.deltaX;
      const proposedY = canvasScroll.y + event.deltaY;
      onScrollChange({ x: proposedX, y: proposedY });
    },
    [canvasScroll.x, canvasScroll.y, onScrollChange],
  );

  const verticalTrackLength = Math.max(
    0,
    viewport.height - VERTICAL_TRACK_MARGIN,
  );
  const horizontalTrackLength = Math.max(
    0,
    viewport.width - HORIZONTAL_TRACK_MARGIN,
  );

  const verticalHandleSize = useMemo(() => {
    if (maxScrollY <= 0 || verticalTrackLength <= 0) return 0;
    const ratio = viewport.height / contentHeight;
    const desired = ratio * verticalTrackLength;
    const maxSize = Math.max(0, verticalTrackLength - VERTICAL_HANDLE_PADDING * 2);
    return Math.min(maxSize, Math.max(MIN_SCROLLBAR_SIZE, desired));
  }, [contentHeight, maxScrollY, verticalTrackLength, viewport.height]);

  const horizontalHandleSize = useMemo(() => {
    if (maxScrollX <= 0 || horizontalTrackLength <= 0) return 0;
    const ratio = viewport.width / contentWidth;
    const desired = ratio * horizontalTrackLength;
    const maxSize = Math.max(0, horizontalTrackLength - HORIZONTAL_HANDLE_PADDING * 2);
    return Math.min(maxSize, Math.max(MIN_SCROLLBAR_SIZE, desired));
  }, [contentWidth, horizontalTrackLength, maxScrollX, viewport.width]);

  const verticalHandleOffset =
    maxScrollY <= 0 || verticalTrackLength <= 0
      ? 0
      : VERTICAL_HANDLE_PADDING +
        (canvasScroll.y / maxScrollY) *
          Math.max(1, verticalTrackLength - verticalHandleSize - VERTICAL_HANDLE_PADDING * 2);
  const horizontalHandleOffset =
    maxScrollX <= 0 || horizontalTrackLength <= 0
      ? 0
      : HORIZONTAL_HANDLE_PADDING +
        (canvasScroll.x / maxScrollX) *
          Math.max(
            1,
            horizontalTrackLength - horizontalHandleSize - HORIZONTAL_HANDLE_PADDING * 2,
          );

  const handleScrollbarPointerDown = useCallback(
    (
      orientation: "horizontal" | "vertical",
      event: ReactPointerEvent<HTMLDivElement>,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const startPointer =
        orientation === "vertical" ? event.clientY : event.clientX;
      const startScroll =
        orientation === "vertical" ? canvasScroll.y : canvasScroll.x;
      const handleSize =
        orientation === "vertical" ? verticalHandleSize : horizontalHandleSize;
      const viewportLength =
        orientation === "vertical"
          ? verticalTrackLength
          : horizontalTrackLength;
      const maxScroll = orientation === "vertical" ? maxScrollY : maxScrollX;
      if (maxScroll <= 0 || viewportLength <= 0) {
        return;
      }
      const trackLength = Math.max(1, viewportLength - handleSize);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const pointer =
          orientation === "vertical" ? moveEvent.clientY : moveEvent.clientX;
        const delta = pointer - startPointer;
        const proposed = startScroll + (delta / trackLength) * maxScroll;
        if (orientation === "vertical") {
          onScrollChange({ x: canvasScroll.x, y: proposed });
        } else {
          onScrollChange({ x: proposed, y: canvasScroll.y });
        }
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [
      canvasScroll.x,
      canvasScroll.y,
      horizontalHandleSize,
      horizontalTrackLength,
      maxScrollX,
      maxScrollY,
      onScrollChange,
      verticalHandleSize,
      verticalTrackLength,
    ],
  );

  return (
    <div
      ref={gridWrapperRef}
      className="relative flex h-full w-full min-h-0 touch-none overflow-hidden"
      style={{
        boxSizing: "border-box",
        maxWidth: wrapperMaxWidth > 0 ? `${wrapperMaxWidth}px` : undefined,
        width: "100%",
        height: wrapperMaxHeight > 0 ? `${wrapperMaxHeight}px` : undefined,
      }}
    >
      <div className="relative flex h-full w-full items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <canvas
          ref={assignCanvasRef}
          className="block touch-none select-none focus:outline-none"
          width={Math.max(1, viewport.width)}
          height={Math.max(1, viewport.height)}
          style={{
            width: `${Math.max(1, viewport.width)}px`,
            height: `${Math.max(1, viewport.height)}px`,
            imageRendering: "pixelated",
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={handleCanvasPointerEnter}
          onPointerLeave={handleCanvasPointerLeave}
          onWheel={handleCanvasWheel}
        />

        {maxScrollY > 0 && verticalHandleSize > 0 && (
          <div className="absolute border-2 border-stone-950 right-2 top-2 bottom-6 w-3 rounded-full bg-zinc-200/60 dark:bg-stone-950">
            <div
              className="absolute left-0 right-0 cursor-pointer rounded-full bg-zinc-500 dark:bg-slate-300"
              style={{
                height: `${verticalHandleSize}px`,
                transform: `translateY(${verticalHandleOffset}px)`,
              }}
              onPointerDown={(event) =>
                handleScrollbarPointerDown("vertical", event)
              }
            />
          </div>
        )}
        {maxScrollX > 0 && horizontalHandleSize > 0 && (
          <div className="absolute border-2 border-stone-950 left-2 right-6 bottom-2 h-3 rounded-full bg-zinc-200/60 dark:bg-stone-950">
            <div
              className="absolute top-0 bottom-0 cursor-pointer rounded-full bg-black-500 dark:bg-slate-300"
              style={{
                width: `${horizontalHandleSize}px`,
                transform: `translateX(${horizontalHandleOffset}px)`,
              }}
              onPointerDown={(event) =>
                handleScrollbarPointerDown("horizontal", event)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
