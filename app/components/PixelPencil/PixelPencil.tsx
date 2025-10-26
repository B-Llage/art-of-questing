"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PaintTool, PaletteTheme } from "./PixelPencilTypes";
import { BucketTool, ColorPickerTool, EraserTool, LineTool, PencilTool, ShapeTool } from "./PixelPencilTools";
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
import { ShapeSelector } from "./Settings/Tool/ShapeSelector";

const GRID_SIZE = 32;
const TRANSPARENT_LIGHT = "#d4d4d8";
const TRANSPARENT_DARK = "#9ca3af";

const MAX_HISTORY = 15;
export const BRUSH_SIZES = [1, 2, 3] as const;

const TOOLS: readonly PaintTool[] = [
  PencilTool,
  LineTool,
  ShapeTool,
  EraserTool,
  BucketTool,
  ColorPickerTool,
] as const;

const PALETTE_THEMES: readonly PaletteTheme[] = PixelPencilPalettes;

const BRUSH_SHAPES = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
] as const;

const SHAPE_TYPES = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "triangle", label: "Triangle" },
] as const;

export type PaletteColor = (typeof PALETTE_THEMES)[number]["colors"][number] | "transparent";
export type PixelValue = PaletteColor | null;
type Tool = (typeof TOOLS)[number]["id"];
export type BrushShape = (typeof BRUSH_SHAPES)[number]["id"];
export type ShapeKind = (typeof SHAPE_TYPES)[number]["id"];

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
  const { previewToolEffects, canvasPixelSize, showPixelGrid } = usePixelPencilSettings();

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
  const [shapeType, setShapeType] = useState<ShapeKind>("square");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isHotkeysDialogOpen, setIsHotkeysDialogOpen] = useState(false);
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
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [pathPreview, setPathPreview] = useState<Set<number> | null>(null);
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
    if (tool !== "line" && tool !== "shape") {
      setDragStartIndex(null);
      setPathPreview(null);
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

 const handleOpenResetDialog = useCallback(() => {
    setIsResetDialogOpen(true);
  }, []);
  
  useEffect(() => {
    const handleToolHotkeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (isSettingsDialogOpen || isResetDialogOpen || isHotkeysDialogOpen) return;
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.isContentEditable)) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === "backspace") {
        event.preventDefault();
        handleOpenResetDialog();
        return;
      }
      const match = TOOLS.find((item) => item.hotkey === key);
      if (!match) return;
      event.preventDefault();
      setTool(match.id);
    };
    window.addEventListener("keydown", handleToolHotkeys);
    return () => window.removeEventListener("keydown", handleToolHotkeys);
  }, [handleOpenResetDialog, isHotkeysDialogOpen, isResetDialogOpen, isSettingsDialogOpen, setTool]);

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
      const current = pixelsRef.current;
      const next = [...current];
      let changed = false;

      for (const pathIndex of path) {
        const indices = computeBrushIndices(pathIndex);
        for (const target of indices) {
          if (next[target] === value) continue;
          next[target] = value;
          changed = true;
        }
      }

      if (!changed) {
        return;
      }

      pixelsRef.current = next;
      actionModifiedRef.current = true;
      setPixels(next);
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

  const computeShapeCells = useCallback(
    (startIndex: number, endIndex: number, shape: ShapeKind) => {
      const startX = startIndex % GRID_SIZE;
      const startY = Math.floor(startIndex / GRID_SIZE);
      const endX = endIndex % GRID_SIZE;
      const endY = Math.floor(endIndex / GRID_SIZE);

      const minX = Math.max(0, Math.min(startX, endX));
      const maxX = Math.min(GRID_SIZE - 1, Math.max(startX, endX));
      const minY = Math.max(0, Math.min(startY, endY));
      const maxY = Math.min(GRID_SIZE - 1, Math.max(startY, endY));
      const topToBottom = startY <= endY;

      const width = Math.max(1, maxX - minX + 1);
      const height = Math.max(1, maxY - minY + 1);

      const cells: number[] = [];

      const pushCell = (x: number, y: number) => {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
        cells.push(y * GRID_SIZE + x);
      };

      if (shape === "square") {
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            pushCell(x, y);
          }
        }
        return cells;
      }

      if (shape === "circle") {
        const centerX = minX + (width - 1) / 2;
        const centerY = minY + (height - 1) / 2;
        const radius = Math.max(width, height) / 2;
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const dx = x - centerX;
            const dy = y - centerY;
            if (dx * dx + dy * dy <= radius * radius) {
              pushCell(x, y);
            }
          }
        }
        return cells;
      }

      const effectiveHeight = Math.max(height - 1, 1);
      const centerX = minX + (width - 1) / 2;
      if (topToBottom) {
        for (let y = minY; y <= maxY; y += 1) {
          const progress = (y - minY) / effectiveHeight;
          const halfSpan = (width - 1) / 2 * (1 - progress);
          const left = Math.round(centerX - halfSpan);
          const right = Math.round(centerX + halfSpan);
          for (let x = left; x <= right; x += 1) {
            pushCell(x, y);
          }
        }
      } else {
        for (let y = maxY; y >= minY; y -= 1) {
          const progress = (maxY - y) / effectiveHeight;
          const halfSpan = (width - 1) / 2 * (1 - progress);
          const left = Math.round(centerX - halfSpan);
          const right = Math.round(centerX + halfSpan);
          for (let x = left; x <= right; x += 1) {
            pushCell(x, y);
          }
        }
      }

      return cells;
    },
    [],
  );

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
    setDragStartIndex(null);
    setPathPreview(null);
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
    const handlePointerUp = () => {
      if (tool === "line" || tool === "shape") {
        if (dragStartIndex !== null) {
          return;
        }
      }
      stopStroke();
    };
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [dragStartIndex, stopStroke, tool]);

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

      if (tool === "line" || tool === "shape") {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          activePointerIdRef.current = event.pointerId;
        } catch {
          activePointerIdRef.current = event.pointerId;
        }
        isDrawingRef.current = true;
        drawValueRef.current = strokeColor;
        lastPaintedIndexRef.current = null;
        setDragStartIndex(index);
        if (previewToolEffects) {
          const initialPath =
            tool === "line"
              ? computeLineIndices(index, index)
              : computeShapeCells(index, index, shapeType);
          setPathPreview(buildLinePreview(initialPath));
        } else {
          setPathPreview(null);
        }
        return;
      }

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        activePointerIdRef.current = event.pointerId;
      } catch {
        activePointerIdRef.current = event.pointerId;
      }

      startStroke(index, strokeColor);
    },
    [
      activeColor,
      beginAction,
      buildLinePreview,
      computeLineIndices,
      computeShapeCells,
      floodFill,
      previewToolEffects,
      shapeType,
      startStroke,
      tool,
    ],
  );

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      setHoverIndex(index);
      if (!isDrawingRef.current) return;
      event.preventDefault();
      if (tool === "line" || tool === "shape") {
        if (dragStartIndex === null) return;
        if (previewToolEffects) {
          const path =
            tool === "line"
              ? computeLineIndices(dragStartIndex, index)
              : computeShapeCells(dragStartIndex, index, shapeType);
          setPathPreview(buildLinePreview(path));
        }
        return;
      }
      continueStroke(index);
    },
    [
      buildLinePreview,
      computeLineIndices,
      computeShapeCells,
      continueStroke,
      dragStartIndex,
      previewToolEffects,
      shapeType,
      tool,
    ],
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
      if (tool === "line" || tool === "shape") {
        if (dragStartIndex === null) return;
        const index = resolveIndexFromPointerEvent(event);
        if (index === null) return;
        event.preventDefault();
        setHoverIndex(index);
        if (previewToolEffects) {
          const path =
            tool === "line"
              ? computeLineIndices(dragStartIndex, index)
              : computeShapeCells(dragStartIndex, index, shapeType);
          setPathPreview(buildLinePreview(path));
        }
        return;
      }

      const index = resolveIndexFromPointerEvent(event);
      if (index === null) return;
      event.preventDefault();
      setHoverIndex(index);
      continueStroke(index);
    },
    [
      buildLinePreview,
      computeLineIndices,
      computeShapeCells,
      dragStartIndex,
      continueStroke,
      previewToolEffects,
      resolveIndexFromPointerEvent,
      shapeType,
      tool,
    ],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const wasDragAction = tool === "line" || tool === "shape";
      const capturedPointer = activePointerIdRef.current;
      const releasePointer = typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId);
      const finalize = () => {
        stopStroke();
        setHoverIndex(null);
      };

      if (wasDragAction) {
        const eventIndex = resolveIndexFromPointerEvent(event);
        const endIndex = eventIndex ?? hoverIndex ?? dragStartIndex;
        if (dragStartIndex !== null && endIndex !== null) {
          const path = tool === "line"
            ? computeLineIndices(dragStartIndex, endIndex)
            : computeShapeCells(dragStartIndex, endIndex, shapeType);
          const before = pixelsRef.current.slice();
          applyLinePath(path, drawValueRef.current);
          const after = pixelsRef.current;
          if (!arePixelsEqual(before, after)) {
            actionModifiedRef.current = true;
          }
        }
        setDragStartIndex(null);
        setPathPreview(null);
        if (releasePointer && event.pointerId === capturedPointer) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finalize();
        return;
      }

      if (releasePointer && event.pointerId === capturedPointer) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finalize();
    },
    [
      applyLinePath,
      computeLineIndices,
      computeShapeCells,
      hoverIndex,
      dragStartIndex,
      resolveIndexFromPointerEvent,
      shapeType,
      stopStroke,
      tool,
    ],
  );

  const handlePointerLeave = useCallback(() => {
    if (!isDrawingRef.current) {
      setHoverIndex(null);
      if (tool === "line" || tool === "shape") {
        setPathPreview(null);
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
      handlePointerDown,
      handlePointerEnter,
      handlePointerMove,
      handlePointerLeave,
      handlePointerUp,
      pixels,
      bucketPreview,
      brushPreview,
      pathPreview,
      previewToolEffects,
      tool,
      displayCellSize,
      showPixelGrid,
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

 

  const handleCloseResetDialog = useCallback(() => {
    setIsResetDialogOpen(false);
  }, []);

  const handleConfirmReset = useCallback(() => {
    setIsResetDialogOpen(false);
    reset();
  }, [reset]);

  const HOTKEYS_MAP = useMemo(
    () => [
      { label: "Pencil", key: "Q" },
      { label: "Eraser", key: "W" },
      { label: "Picker", key: "E" },
      { label: "Bucket", key: "G" },
      { label: "Shape", key: "S" },
      { label: "Line", key: "L" },
      { label: "Undo", key: "Ctrl/Cmd + Z" },
      { label: "Redo", key: "Ctrl/Cmd + Shift + Z" },
      { label: "Clear", key: "Ctrl/Cmd + Backspace" },
    ],
    [],
  );

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

  const handleCloseHotkeysDialog = useCallback(() => {
    setIsHotkeysDialogOpen(false);
  }, []);

  useEffect(() => {
    if (!isHotkeysDialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHotkeysDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHotkeysDialogOpen]);

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
              onClick={() => setIsHotkeysDialogOpen(true)}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
            >
              Hotkeys
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
            {currentTool.settings.shapeType && (
              <ShapeSelector
                options={SHAPE_TYPES}
                value={shapeType}
                onChange={setShapeType}
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
      {isHotkeysDialogOpen && (
        <ActionRequestModal
          title="Hotkeys"
          handleClose={handleCloseHotkeysDialog}
          handleConfirm={handleCloseHotkeysDialog}
          confirmText="Close"
          hideCancelButton
          renderBody={() => (
            <ul className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              {HOTKEYS_MAP.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4">
                  <span className="font-medium">{item.label}</span>
                  <span className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs uppercase text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                    {item.key}
                  </span>
                </li>
              ))}
            </ul>
          )}
        />
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
