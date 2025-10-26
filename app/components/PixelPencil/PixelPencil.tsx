"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PaintTool, PaletteTheme } from "./PixelPencilTypes";
import { BucketTool, ColorPickerTool, EraserTool, LineTool, PencilTool } from "./PixelPencilTools";
import Image from 'next/image'
import { PixelPencilPalettes } from "./PixelPencilPalettes";
import { usePixelPencilSettings } from "./PixelPencilSettingsContext";
import { SettingsModal } from "./Settings/SettingsModal";
import { ActionRequestModal } from "../shared/ActionRequestModal";
import { ColorPalette } from "./Settings/Tool/ColorPalette";
import { SelectedColor } from "./Settings/Tool/SelectedColor";
import { PaletteThemeSelector } from "./Settings/Tool/PaletteThemeSelector";
import { BrushSizeSelector } from "./Settings/Tool/BrushSizeSelector";
import { BrushShapeSelector } from "./Settings/Tool/BrushShapeSelector";

const GRID_SIZE = 32;
const TRANSPARENT_LIGHT = "#d4d4d8";
const TRANSPARENT_DARK = "#9ca3af";

const MAX_HISTORY = 15;
export const BRUSH_SIZES = [1, 2, 3] as const;

const TOOLS: readonly PaintTool[] = [
  PencilTool,
  EraserTool,
  ColorPickerTool,
  BucketTool,
  LineTool,
] as const;

const PALETTE_THEMES: readonly PaletteTheme[] = PixelPencilPalettes;

const BRUSH_SHAPES = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
] as const;

export type PaletteColor = (typeof PALETTE_THEMES)[number]["colors"][number] | "transparent";
export type PixelValue = PaletteColor | null;
type Tool = (typeof TOOLS)[number]["id"];
export type BrushShape = (typeof BRUSH_SHAPES)[number]["id"];

const makeEmptyGrid = (): PixelValue[] =>
  new Array(GRID_SIZE * GRID_SIZE).fill(null) as PixelValue[];

const arePixelsEqual = (a: PixelValue[], b: PixelValue[]) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
};

export function PixelPencil() {
  const { previewToolEffects, canvasPixelSize } = usePixelPencilSettings();

  const [pixels, setPixels] = useState<PixelValue[]>(() => makeEmptyGrid());
  const [paletteThemeId, setPaletteThemeId] = useState<
    (typeof PALETTE_THEMES)[number]["id"]
  >(PALETTE_THEMES[0].id);
  const [activeColor, setActiveColor] = useState<PaletteColor>(
    PALETTE_THEMES[0].colors[0],
  );
  const [tool, setTool] = useState<Tool>("pencil");
  const [brushSize, setBrushSize] = useState<number>(1);
  const [brushShape, setBrushShape] = useState<BrushShape>("square");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const isDrawingRef = useRef(false);
  const drawValueRef = useRef<PixelValue>(PALETTE_THEMES[0].colors[0]);
  const lastPaintedIndexRef = useRef<number | null>(null);
  const pixelsRef = useRef(pixels);
  const undoStackRef = useRef<PixelValue[][]>([]);
  const redoStackRef = useRef<PixelValue[][]>([]);
  const actionInProgressRef = useRef(false);
  const actionModifiedRef = useRef(false);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [lineStartIndex, setLineStartIndex] = useState<number | null>(null);
  const [linePreview, setLinePreview] = useState<Set<number> | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const currentPalette = useMemo(() => {
    const found = PALETTE_THEMES.find((theme) => theme.id === paletteThemeId);
    return found ?? PALETTE_THEMES[0];
  }, [paletteThemeId]);

  const currentTool = useMemo(() => {
    const found = TOOLS.find((item) => item.id === tool);
    return found ?? PencilTool;
  }, [tool]);

  const paletteColors = useMemo(
    () => [...currentPalette.colors, "transparent"] as PaletteColor[],
    [currentPalette],
  );

  const displayCellSize = useMemo(() => {
    if (!availableWidth) {
      return canvasPixelSize;
    }
    const paddingOffset = 8; // account for grid padding (p-2)
    const effectiveWidth = Math.max(0, availableWidth - paddingOffset);
    const maxCellSize = Math.floor(effectiveWidth / GRID_SIZE);
    if (!Number.isFinite(maxCellSize) || maxCellSize <= 0) {
      return canvasPixelSize;
    }
    const clamped = Math.max(4, maxCellSize);
    return Math.min(canvasPixelSize, clamped);
  }, [availableWidth, canvasPixelSize]);

  useEffect(() => {
    pixelsRef.current = pixels;
  }, [pixels]);

  useEffect(() => {
    if (typeof window === "undefined" || !gridWrapperRef.current) {
      return;
    }
    const updateSize = () => {
      if (!gridWrapperRef.current) return;
      setAvailableWidth(gridWrapperRef.current.clientWidth);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(gridWrapperRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    if (tool !== "line") {
      setLineStartIndex(null);
      setLinePreview(null);
      activePointerIdRef.current = null;
      isDrawingRef.current = false;
      lastPaintedIndexRef.current = null;
    }
  }, [tool]);

  const updateHistoryState = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  useEffect(() => {
    updateHistoryState();
  }, [updateHistoryState]);



  const recordSnapshot = useCallback(() => {
    const snapshot = [...pixelsRef.current];
    const undoStack = undoStackRef.current;
    const lastSnapshot = undoStack[undoStack.length - 1];
    if (lastSnapshot && arePixelsEqual(lastSnapshot, snapshot)) {
      return;
    }
    if (undoStack.length === MAX_HISTORY) {
      undoStack.shift();
    }
    undoStack.push(snapshot);
    updateHistoryState();
  }, [updateHistoryState]);

  const beginAction = useCallback(() => {
    if (actionInProgressRef.current) return;
    recordSnapshot();
    redoStackRef.current = [];
    updateHistoryState();
    actionInProgressRef.current = true;
    actionModifiedRef.current = false;
  }, [recordSnapshot, updateHistoryState]);

  const finalizeAction = useCallback(() => {
    if (!actionInProgressRef.current) return;
    const undoStack = undoStackRef.current;
    const lastSnapshot = undoStack[undoStack.length - 1];
    if (lastSnapshot && arePixelsEqual(lastSnapshot, pixelsRef.current)) {
      undoStack.pop();
    }
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [updateHistoryState]);

  const undo = useCallback(() => {
    if (actionInProgressRef.current) return;
    const undoStack = undoStackRef.current;
    if (!undoStack.length) return;
    const previous = undoStack.pop();
    if (!previous) return;
    const currentSnapshot = [...pixelsRef.current];
    if (redoStackRef.current.length === MAX_HISTORY) {
      redoStackRef.current.shift();
    }
    redoStackRef.current.push(currentSnapshot);
    const restored = previous.slice();
    pixelsRef.current = restored;
    setPixels(restored);
    setHoverIndex(null);
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [setPixels, updateHistoryState]);

  const redo = useCallback(() => {
    if (actionInProgressRef.current) return;
    const redoStack = redoStackRef.current;
    if (!redoStack.length) return;
    const next = redoStack.pop();
    if (!next) return;
    const currentSnapshot = [...pixelsRef.current];
    const undoStack = undoStackRef.current;
    if (undoStack.length === MAX_HISTORY) {
      undoStack.shift();
    }
    undoStack.push(currentSnapshot);
    const restored = next.slice();
    pixelsRef.current = restored;
    setPixels(restored);
    setHoverIndex(null);
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [setPixels, updateHistoryState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== "z") return;
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      event.preventDefault();

      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  const computeBrushIndices = useCallback(
    (centerIndex: number) => {
      const centerX = centerIndex % GRID_SIZE;
      const centerY = Math.floor(centerIndex / GRID_SIZE);
      const startOffset = -Math.floor((brushSize - 1) / 2);
      const endOffset = Math.ceil((brushSize - 1) / 2);
      const indices: number[] = [];

      for (let dy = startOffset; dy <= endOffset; dy += 1) {
        for (let dx = startOffset; dx <= endOffset; dx += 1) {
          if (
            brushShape === "circle" &&
            Math.abs(dx) + Math.abs(dy) > 1
          ) {
            continue;
          }

          const x = centerX + dx;
          const y = centerY + dy;

          if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
            continue;
          }

          indices.push(y * GRID_SIZE + x);
        }
      }

      return indices;
    },
    [brushShape, brushSize],
  );

  const applyBrush = useCallback(
    (index: number, value: PixelValue) => {
      const indices = computeBrushIndices(index);
      if (indices.length === 0) return;

      let changed = false;
      setPixels((prev) => {
        const next = [...prev];

        for (const target of indices) {
          if (next[target] === value) continue;
          next[target] = value;
          changed = true;
        }

        if (!changed) {
          return prev;
        }

        pixelsRef.current = next;
        return next;
      });

      if (changed) {
        actionModifiedRef.current = true;
      }
    },
    [computeBrushIndices],
  );

  const applyLinePath = useCallback(
    (path: number[], value: PixelValue) => {
      if (!path.length) return;
      setPixels((prev) => {
        let changed = false;
        const next = [...prev];

        for (const pathIndex of path) {
          const indices = computeBrushIndices(pathIndex);
          for (const target of indices) {
            if (next[target] === value) continue;
            next[target] = value;
            changed = true;
          }
        }

        if (!changed) {
          return prev;
        }

        pixelsRef.current = next;
        actionModifiedRef.current = true;
        return next;
      });
    },
    [computeBrushIndices, setPixels],
  );

  const buildLinePreview = useCallback(
    (path: number[]) => {
      const preview = new Set<number>();
      for (const index of path) {
        const indices = computeBrushIndices(index);
        for (const target of indices) {
          preview.add(target);
        }
      }
      return preview;
    },
    [computeBrushIndices],
  );

  const startStroke = useCallback(
    (index: number, nextValue: PixelValue) => {
      isDrawingRef.current = true;
      drawValueRef.current = nextValue;
      lastPaintedIndexRef.current = index;
      applyBrush(index, drawValueRef.current);
    },
    [applyBrush],
  );

  const computeLineIndices = useCallback((startIndex: number, endIndex: number) => {
    if (startIndex === endIndex) {
      return [startIndex];
    }

    const coordinatesToIndex = (x: number, y: number) => y * GRID_SIZE + x;
    let x0 = startIndex % GRID_SIZE;
    let y0 = Math.floor(startIndex / GRID_SIZE);
    const x1 = endIndex % GRID_SIZE;
    const y1 = Math.floor(endIndex / GRID_SIZE);

    const result: number[] = [];

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    // Bresenham's line algorithm
    while (true) {
      result.push(coordinatesToIndex(x0, y0));
      if (x0 === x1 && y0 === y1) {
        break;
      }
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return result;
  }, []);

  const continueStroke = useCallback(
    (index: number) => {
      if (!isDrawingRef.current) return;
      const previousIndex = lastPaintedIndexRef.current;
      if (previousIndex === null) {
        applyBrush(index, drawValueRef.current);
        lastPaintedIndexRef.current = index;
        return;
      }
      if (previousIndex === index) {
        applyBrush(index, drawValueRef.current);
        lastPaintedIndexRef.current = index;
        return;
      }
      const line = computeLineIndices(previousIndex, index);
      for (let position = 1; position < line.length; position += 1) {
        applyBrush(line[position], drawValueRef.current);
      }
      lastPaintedIndexRef.current = index;
    },
    [applyBrush, computeLineIndices],
  );

  const stopStroke = useCallback(() => {
    isDrawingRef.current = false;
    lastPaintedIndexRef.current = null;
    activePointerIdRef.current = null;
    setLineStartIndex(null);
    setLinePreview(null);
    finalizeAction();
  }, [finalizeAction]);

  const floodFill = useCallback((startIndex: number, fillValue: PixelValue) => {
    let changed = false;
    setPixels((prev) => {
      const targetValue = prev[startIndex];
      if (targetValue === fillValue) {
        return prev;
      }

      const next = [...prev];
      const stack = [startIndex];
      const visited = new Set<number>();

      while (stack.length) {
        const index = stack.pop();
        if (index === undefined || visited.has(index)) continue;
        visited.add(index);

        if (prev[index] !== targetValue) continue;

        next[index] = fillValue;
        changed = true;

        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);

        if (x > 0) stack.push(index - 1);
        if (x < GRID_SIZE - 1) stack.push(index + 1);
        if (y > 0) stack.push(index - GRID_SIZE);
        if (y < GRID_SIZE - 1) stack.push(index + GRID_SIZE);
      }

      if (!changed) {
        return prev;
      }

      pixelsRef.current = next;
      return next;
    });

    if (changed) {
      actionModifiedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const handlePointerUp = () => stopStroke();
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [stopStroke]);

  const resolveIndexFromPointerEvent = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (!gridRef.current || displayCellSize <= 0) return null;
      const rect = gridRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const column = Math.floor(x / displayCellSize);
      const row = Math.floor(y / displayCellSize);
      if (
        Number.isNaN(column) ||
        Number.isNaN(row) ||
        column < 0 ||
        column >= GRID_SIZE ||
        row < 0 ||
        row >= GRID_SIZE
      ) {
        return null;
      }
      return row * GRID_SIZE + column;
    },
    [displayCellSize],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      event.preventDefault();
      setHoverIndex(index);

      if (tool === "picker") {
        const currentPixels = pixelsRef.current;
        const value = currentPixels[index];
        const pickedColor: PaletteColor =
          value === null ? "transparent" : (value as PaletteColor);
        setActiveColor(pickedColor);
        drawValueRef.current = pickedColor;
        return;
      }

      const isRightClick = event.button === 2;
      const isErase = isRightClick || event.altKey || event.metaKey || event.ctrlKey;
      beginAction();
      if (tool === "bucket") {
        floodFill(index, isErase ? null : activeColor);
        return;
      }
      const strokeColor =
        tool === "eraser" ? null : isErase ? null : activeColor;

      if (tool === "line") {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          activePointerIdRef.current = event.pointerId;
        } catch {
          activePointerIdRef.current = event.pointerId;
        }
        isDrawingRef.current = true;
        drawValueRef.current = strokeColor;
        lastPaintedIndexRef.current = null;
        setLineStartIndex(index);
        if (previewToolEffects) {
          const initialPath = computeLineIndices(index, index);
          setLinePreview(buildLinePreview(initialPath));
        } else {
          setLinePreview(null);
        }
        return;
      }

      startStroke(index, strokeColor);
    },
    [
      activeColor,
      beginAction,
      buildLinePreview,
      computeLineIndices,
      floodFill,
      previewToolEffects,
      startStroke,
      tool,
    ],
  );

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      setHoverIndex(index);
      if (!isDrawingRef.current) return;
      event.preventDefault();
      if (tool === "line") {
        if (lineStartIndex === null) return;
        if (previewToolEffects) {
          const path = computeLineIndices(lineStartIndex, index);
          setLinePreview(buildLinePreview(path));
        }
        return;
      }
      continueStroke(index);
    },
    [buildLinePreview, computeLineIndices, continueStroke, lineStartIndex, previewToolEffects, tool],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isDrawingRef.current) return;
      if (
        activePointerIdRef.current !== null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      if (tool === "line") {
        if (lineStartIndex === null) return;
        const index = resolveIndexFromPointerEvent(event);
        if (index === null) return;
        event.preventDefault();
        setHoverIndex(index);
        if (previewToolEffects) {
          const path = computeLineIndices(lineStartIndex, index);
          setLinePreview(buildLinePreview(path));
        }
        return;
      }
    },
    [buildLinePreview, computeLineIndices, lineStartIndex, previewToolEffects, resolveIndexFromPointerEvent, tool],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (tool === "line" && lineStartIndex !== null) {
        const eventIndex = resolveIndexFromPointerEvent(event);
        const endIndex =
          eventIndex ?? hoverIndex ?? lineStartIndex;
        const path = computeLineIndices(lineStartIndex, endIndex);
        applyLinePath(path, drawValueRef.current);
        setLineStartIndex(null);
        setLinePreview(null);
      }
      stopStroke();
      setHoverIndex(null);
    },
    [
      applyLinePath,
      computeLineIndices,
      hoverIndex,
      lineStartIndex,
      resolveIndexFromPointerEvent,
      stopStroke,
      tool,
    ],
  );

  const handlePointerLeave = useCallback(() => {
    if (!isDrawingRef.current) {
      setHoverIndex(null);
      if (tool === "line") {
        setLinePreview(null);
      }
    }
  }, [tool]);

  // Render matrix once so React keys stay stable.
  const bucketPreview = useMemo(() => {
    if (!previewToolEffects || hoverIndex === null || tool !== "bucket") return null;
    const targetColor = pixels[hoverIndex];
    if (targetColor === undefined) return null;

    const visited = new Set<number>();
    const stack = [hoverIndex];
    const region = new Set<number>();

    while (stack.length) {
      const index = stack.pop();
      if (index === undefined || visited.has(index)) continue;
      visited.add(index);

      if (pixels[index] !== targetColor) continue;

      region.add(index);

      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);

      if (x > 0) stack.push(index - 1);
      if (x < GRID_SIZE - 1) stack.push(index + 1);
      if (y > 0) stack.push(index - GRID_SIZE);
      if (y < GRID_SIZE - 1) stack.push(index + GRID_SIZE);
    }

    return region;
  }, [hoverIndex, pixels, previewToolEffects, tool]);

  const brushPreview = useMemo(() => {
    if (
      !previewToolEffects ||
      hoverIndex === null ||
      (tool !== "pencil" && tool !== "eraser")
    ) {
      return null;
    }
    return new Set(computeBrushIndices(hoverIndex));
  }, [computeBrushIndices, hoverIndex, previewToolEffects, tool]);

  const cells = useMemo(
    () =>
      pixels.map((pixel, index) => {
        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);
        const key = `${x}-${y}`;
        const isTransparent = pixel === null || pixel === "transparent";
        const patternColor =
          (x + y) % 2 === 0 ? TRANSPARENT_LIGHT : TRANSPARENT_DARK;
        const fillColor = isTransparent ? patternColor : (pixel as PaletteColor);
        const isLinePreviewCell = linePreview?.has(index) ?? false;
        const showLinePreview = previewToolEffects && isLinePreviewCell;
        const previewValue = showLinePreview ? drawValueRef.current : null;
        const previewFillColor =
          previewValue === null || previewValue === "transparent"
            ? patternColor
            : (previewValue as PaletteColor);
        const cellBackgroundColor = showLinePreview ? previewFillColor : fillColor;
        return (
          <button
            key={key}
            type="button"
            className="relative border border-zinc-200 touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
            style={{
              width: `${displayCellSize}px`,
              height: `${displayCellSize}px`,
              backgroundColor: cellBackgroundColor,
              opacity:
                tool === "bucket"
                  ? bucketPreview?.has(index)
                    ? 0.7
                    : 1
                  : showLinePreview
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
      handlePointerDown,
      handlePointerEnter,
      handlePointerMove,
      handlePointerLeave,
      handlePointerUp,
      pixels,
      bucketPreview,
      brushPreview,
      linePreview,
      previewToolEffects,
      tool,
      displayCellSize,
    ],
  );

  const reset = useCallback(() => {
    const current = pixelsRef.current;
    const isAlreadyEmpty = current.every((value) => value === null);
    if (isAlreadyEmpty) return;
    recordSnapshot();
    redoStackRef.current = [];
    const cleared = makeEmptyGrid();
    pixelsRef.current = cleared;
    setPixels(cleared);
    setHoverIndex(null);
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [recordSnapshot, setPixels, updateHistoryState]);

  const handleOpenResetDialog = useCallback(() => {
    setIsResetDialogOpen(true);
  }, []);

  const handleCloseResetDialog = useCallback(() => {
    setIsResetDialogOpen(false);
  }, []);

  const handleConfirmReset = useCallback(() => {
    setIsResetDialogOpen(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (!isResetDialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsResetDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isResetDialogOpen]);

  const handleOpenSettingsDialog = useCallback(() => {
    setIsSettingsDialogOpen(true);
  }, []);

  const handleCloseSettingsDialog = useCallback(() => {
    setIsSettingsDialogOpen(false);
  }, []);

  useEffect(() => {
    if (!isSettingsDialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsDialogOpen]);

  const downloadPng = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.imageSmoothingEnabled = false;

    for (let index = 0; index < pixels.length; index += 1) {
      const color = pixels[index];
      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);
      if (color === null || color === "transparent") {
        ctx.clearRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pixel-art.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [pixels]);

  const toolButtons = useMemo(
    () =>
      TOOLS.map((option) => {
        const isSelected = option.id === tool;
        return (
          <button
            key={option.id}
            type="button"
            className={`rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${isSelected
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            onClick={() => setTool(option.id)}
          >
            <div className="flex flex-col items-center gap-2">
              <Image
                src={option.icon}
                width={32}
                height={32}
                alt={`${option.label} icon`}
                unoptimized
                style={{ imageRendering: "pixelated" }}
              />
              <span>{option.label}</span>
            </div>

          </button>

        );
      }),
    [tool],
  );

  const selectedColorStyles = useMemo(() => {
    const isTransparent = activeColor === "transparent";
    return {
      backgroundColor: isTransparent ? "transparent" : activeColor,
      backgroundImage: isTransparent
        ? "linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%, #d1d5db), linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%, #d1d5db)"
        : undefined,
      backgroundSize: isTransparent ? "12px 12px" : undefined,
      backgroundPosition: isTransparent ? "0 0, 6px 6px" : undefined,
    };
  }, [activeColor]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
        <span>Left click to draw or fill</span>
        <span>Alt/Ctrl/⌘ or right click to erase</span>
        <span>Bucket fills enclosed regions</span>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Toolbox
                </span>
              </div>
              <div className="flex flex-wrap gap-3">{toolButtons}</div>
            </div>
          </div>
          <div ref={gridWrapperRef} className="w-full overflow-hidden touch-none">
            <div
              ref={gridRef}
              className="grid mx-auto max-w-full rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, ${displayCellSize}px)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, ${displayCellSize}px)`,
                }}
            >
              {cells}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={undo}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
              disabled={!canUndo}
              aria-label="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
              disabled={!canRedo}
              aria-label="Redo"
            >
              Redo
            </button>
            <button
              type="button"
              onClick={handleOpenResetDialog}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleOpenSettingsDialog}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={downloadPng}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
            >
              Save PNG
            </button>
          </div>
        </div>
        <aside className="w-full flex-shrink-0 lg:max-w-xs xl:max-w-sm">
          <div className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Tool Settings
            </span>

            {currentTool.settings.brushSize && (
              <BrushSizeSelector
                options={BRUSH_SIZES}
                value={brushSize}
                onChange={setBrushSize}
              />
            )}

            {currentTool.settings.brushShape && (
              <BrushShapeSelector
                options={BRUSH_SHAPES}
                value={brushShape}
                onChange={setBrushShape}
              />
            )}
            {currentTool.settings.paletteTheme && (
              <PaletteThemeSelector
                paletteThemeId={paletteThemeId}
                currentPalette={currentPalette}
                drawValueRef={drawValueRef} 
                setPaletteThemeId={setPaletteThemeId}
                setActiveColor={setActiveColor}
                />
            )}
            {currentTool.settings.palette && (
              <ColorPalette paletteColors={paletteColors} setActiveColor={setActiveColor} drawValueRef={drawValueRef} />
            )}
            {currentTool.settings.selectedColor && (
              <SelectedColor selectedColorStyles={selectedColorStyles} />
            )}
          </div>
        </aside>
      </div>
      {isSettingsDialogOpen && (
        <SettingsModal handleCloseSettingsDialog={handleCloseSettingsDialog} />
      )}
      {isResetDialogOpen && (
        <ActionRequestModal
          title="Clear Pixel Art?"
          message="This will erase the entire grid. Are you sure you want to continue?"
          handleClose={handleCloseResetDialog}
          handleConfirm={handleConfirmReset}
        />
      )}
    </div>
  );
}
