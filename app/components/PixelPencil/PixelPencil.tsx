"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PaintTool, PaletteTheme, BrushShape, PaletteColor, PixelValue, ShapeKind } from "./PixelPencilTypes";
import { BucketTool, ColorPickerTool, EraserTool, LineTool, MagnifierTool, PencilTool, ShapeTool } from "./PixelPencilTools";
import { PixelPencilPalettes } from "./PixelPencilPalettes";
import { CANVAS_PIXEL_SIZE_OPTIONS, usePixelPencilSettings } from "./context/PixelPencilSettingsContext";
import { MAX_HISTORY } from "./PixelPencil.constants";
import { usePixelExport } from "./hooks/usePixelExport";
import { useZoomControls } from "./hooks/useZoomControls";
import { Toolbox } from "./Toolbox";
import { ToolSettingsPanel } from "./ToolSettingsPanel";
import { PixelGrid } from "./PixelGrid";
import { PixelPencilModals } from "./PixelPencilModals";
import { LayersPanel } from "./LayersPanel";

const TOOLS: readonly PaintTool[] = [
  PencilTool,
  EraserTool,
  ColorPickerTool,
  MagnifierTool,
  ShapeTool,
  LineTool,
  BucketTool,
] as const;

const PALETTE_THEMES: readonly PaletteTheme[] = PixelPencilPalettes;
type Tool = (typeof TOOLS)[number]["id"];

const RESAMPLE_STEP = 0.5; // cells
const MAX_SEGMENT_STEPS = 2048;


const arePixelsEqual = (a: PixelValue[], b: PixelValue[]) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
};

type Layer = {
  id: string;
  name: string;
  pixels: PixelValue[];
  visible: boolean;
};

type LayerSnapshot = {
  layers: Layer[];
  activeLayerId: string;
};

const createLayerId = () =>
  `layer-${Math.random().toString(36).slice(2, 7)}${Date.now().toString(36)}`;

const cloneLayer = (layer: Layer, totalCells: number): Layer => {
  const pixels = new Array(totalCells).fill(null) as PixelValue[];
  const limit = Math.min(totalCells, layer.pixels.length);
  for (let index = 0; index < limit; index += 1) {
    pixels[index] = layer.pixels[index] ?? null;
  }
  return {
    ...layer,
    pixels,
  };
};

const cloneLayers = (layers: Layer[], totalCells: number) =>
  layers.map((layer) => cloneLayer(layer, totalCells));

const areLayersEqual = (a: Layer[], b: Layer[]) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const layerA = a[index];
    const layerB = b[index];
    if (
      layerA.id !== layerB.id ||
      layerA.name !== layerB.name ||
      layerA.visible !== layerB.visible ||
      !arePixelsEqual(layerA.pixels, layerB.pixels)
    ) {
      return false;
    }
  }
  return true;
};

const composeLayers = (layers: Layer[], totalCells: number): PixelValue[] => {
  const composed = new Array(totalCells).fill(null) as PixelValue[];
  for (let index = 0; index < totalCells; index += 1) {
    for (let layerIndex = layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
      const layer = layers[layerIndex];
      if (!layer.visible) continue;
      const value = layer.pixels[index];
      if (value === null || value === "transparent") continue;
      composed[index] = value;
      break;
    }
  }
  return composed;
};

const generateLayerName = (existingLayers: Layer[]) => {
  let suffix = existingLayers.length + 1;
  while (existingLayers.some((layer) => layer.name === `Layer ${suffix}`)) {
    suffix += 1;
  }
  return `Layer ${suffix}`;
};

export function PixelPencil() {
  const {
    previewToolEffects,
    canvasPixelSize,
    setCanvasPixelSize,
    gridWidth,
    gridHeight,
    showPixelGrid,
  } = usePixelPencilSettings();

  const totalCells = gridWidth * gridHeight;
  const createEmptyPixelArray = () =>
    new Array(totalCells).fill(null) as PixelValue[];
  const initialLayerIdRef = useRef<string | null>(null);
  if (!initialLayerIdRef.current) {
    initialLayerIdRef.current = createLayerId();
  }
  const initialLayerPixelsRef = useRef<PixelValue[] | null>(null);
  if (
    !initialLayerPixelsRef.current ||
    initialLayerPixelsRef.current.length !== totalCells
  ) {
    initialLayerPixelsRef.current = createEmptyPixelArray();
  }
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      id: initialLayerIdRef.current as string,
      name: "Layer 1",
      pixels: initialLayerPixelsRef.current as PixelValue[],
      visible: true,
    },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>(
    initialLayerIdRef.current as string,
  );
  const [activeLayerPixels, setActiveLayerPixelsState] = useState<PixelValue[]>(
    initialLayerPixelsRef.current as PixelValue[],
  );
  const [compositePixels, setCompositePixels] = useState<PixelValue[]>(
    () => createEmptyPixelArray(),
  );
  const [layerPreviews, setLayerPreviews] = useState<Record<string, string>>({});
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
  const [shapeFilled, setShapeFilled] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const setHoverIndexIfChanged = useCallback((next: number | null) => {
    setHoverIndex((prev) => (prev === next ? prev : next));
  }, []);
  const [lastPointedIndex, setLastPointedIndex] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isHotkeysDialogOpen, setIsHotkeysDialogOpen] = useState(false);
  const { zoomScale, zoomMode, setZoomMode, applyZoom } = useZoomControls();
  const isDrawingRef = useRef(false);
  const drawValueRef = useRef<PixelValue>(PALETTE_THEMES[0].colors[0]);
  const [drawValueVersion, setDrawValueVersion] = useState(0);
  const setDrawValue = useCallback((value: PixelValue) => {
    if (drawValueRef.current === value) {
      return;
    }
    drawValueRef.current = value;
    setDrawValueVersion((prev) => prev + 1);
  }, []);
  const lastPaintedIndexRef = useRef<number | null>(null);
  const strokeWorldPointsRef = useRef<{ x: number; y: number }[] | null>(null);
  const strokeAppliedCellsRef = useRef<Set<number> | null>(null);
  const activeLayerPixelsRef = useRef(activeLayerPixels);
  const compositePixelsRef = useRef(compositePixels);
  const layersRef = useRef(layers);
  const undoStackRef = useRef<LayerSnapshot[]>([]);
  const redoStackRef = useRef<LayerSnapshot[]>([]);
  const actionInProgressRef = useRef(false);
  const actionModifiedRef = useRef(false);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const wrapperParentWidthRef = useRef<number | null>(null);
  const wrapperParentHeightRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerQueueRef = useRef<{ x: number; y: number }[]>([]);
  const pointerRAFRef = useRef<number | null>(null);
  const zoomFocusIndexRef = useRef<number | null>(null);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [pathPreview, setPathPreview] = useState<Set<number> | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const [availableHeight, setAvailableHeight] = useState<number>(0);
  const [canvasScroll, setCanvasScroll] = useState({ x: 0, y: 0 });
  const [canvasViewport, setCanvasViewport] = useState({ width: 0, height: 0 });
  const prevDimensionsRef = useRef({ width: gridWidth, height: gridHeight });
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const setActiveLayerPixels = useCallback(
    (
      next:
        | PixelValue[]
        | ((previous: PixelValue[]) => PixelValue[] | PixelValue[]),
    ) => {
      const previousPixels = activeLayerPixelsRef.current;
      const resolvedPixels =
        typeof next === "function"
          ? (next as (prev: PixelValue[]) => PixelValue[])(previousPixels)
          : next;
      if (
        previousPixels === resolvedPixels ||
        (previousPixels &&
          resolvedPixels &&
          arePixelsEqual(previousPixels, resolvedPixels))
      ) {
        return;
      }

      activeLayerPixelsRef.current = resolvedPixels;
      setActiveLayerPixelsState(resolvedPixels);

      const currentLayers = layersRef.current;
      const index = currentLayers.findIndex(
        (layer) => layer.id === activeLayerId,
      );
      if (index === -1) {
        return;
      }
      const targetLayer = currentLayers[index];
      if (targetLayer.pixels === resolvedPixels) {
        return;
      }
      const updatedLayers = [...currentLayers];
      updatedLayers[index] = {
        ...targetLayer,
        pixels: resolvedPixels,
      };
      layersRef.current = updatedLayers;
      setLayers(updatedLayers);
    },
    [activeLayerId],
  );
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
  const indexToCoords = useCallback(
    (index: number) => ({
      x: index % gridWidth,
      y: Math.floor(index / gridWidth),
    }),
    [gridWidth],
  );

  const coordsToIndex = useCallback(
    (x: number, y: number) => y * gridWidth + x,
    [gridWidth],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!layers.length || gridWidth <= 0 || gridHeight <= 0) {
      setLayerPreviews({});
      return;
    }
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const maxDimension = Math.max(gridWidth, gridHeight);
      const maxPreviewSize = 64;
      const scale = Math.max(1, Math.floor(maxPreviewSize / maxDimension));
      const canvas = document.createElement("canvas");
      canvas.width = gridWidth * scale;
      canvas.height = gridHeight * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;

      const checkerSize = Math.max(scale, 2);
      const previews: Record<string, string> = {};

      const drawCheckerboard = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#e4e4e7";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f4f4f5";
        for (let y = 0; y < canvas.height; y += checkerSize) {
          const offset = (Math.floor(y / checkerSize) % 2) * checkerSize;
          for (let x = offset; x < canvas.width; x += checkerSize * 2) {
            ctx.fillRect(x, y, checkerSize, checkerSize);
          }
        }
      };

      for (const layer of layers) {
        drawCheckerboard();
        ctx.globalAlpha = layer.visible ? 1 : 0.4;
        for (let index = 0; index < layer.pixels.length; index += 1) {
          const color = layer.pixels[index];
          if (color === null || color === "transparent") continue;
          const { x, y } = indexToCoords(index);
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
        ctx.globalAlpha = 1;
        previews[layer.id] = canvas.toDataURL("image/png");
      }

      if (!cancelled) {
        setLayerPreviews(previews);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [gridHeight, gridWidth, indexToCoords, layers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(query.matches);
    update();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      pointerQueueRef.current.length = 0;
      if (pointerRAFRef.current !== null) {
        window.cancelAnimationFrame(pointerRAFRef.current);
        pointerRAFRef.current = null;
      }
    };
  }, []);

  const isInBounds = useCallback(
    (x: number, y: number) => x >= 0 && x < gridWidth && y >= 0 && y < gridHeight,
    [gridHeight, gridWidth],
  );

  const {
    isOpen: isSaveDialogOpen,
    open: handleOpenSaveDialog,
    close: handleCloseSaveDialog,
    confirmSave: handleConfirmSave,
    exportScale,
    setExportScale: setExportScaleState,
    exportFilename,
    setExportFilename: setExportFilenameState,
    previewDataUrl,
  } = usePixelExport({
    gridWidth,
    gridHeight,
    pixels: compositePixels,
    indexToCoords,
  });

  const baseCellSize = useMemo(() => {
    if (!availableWidth) {
      return canvasPixelSize;
    }
    const paddingOffset = 8; // account for grid padding (p-2)
    let effectiveWidth = Math.max(0, availableWidth - paddingOffset);
    if (isMobile && viewportWidth) {
      const viewportAvailable = Math.max(
        0,
        viewportWidth - paddingOffset - 24,
      );
      effectiveWidth = Math.min(effectiveWidth, viewportAvailable);
    }
    const maxCellSizeWidth = Math.floor(effectiveWidth / gridWidth);

    const dimensionCandidates: number[] = [];
    if (Number.isFinite(maxCellSizeWidth) && maxCellSizeWidth > 0) {
      dimensionCandidates.push(maxCellSizeWidth);
    }

    if (availableHeight) {
      const effectiveHeight = Math.max(0, availableHeight - paddingOffset);
      const maxCellSizeHeight = Math.floor(effectiveHeight / gridHeight);
      if (Number.isFinite(maxCellSizeHeight) && maxCellSizeHeight > 0) {
        dimensionCandidates.push(maxCellSizeHeight);
      }
    }

    if (!dimensionCandidates.length) {
      return canvasPixelSize;
    }

    const dimensionLimit = Math.min(...dimensionCandidates);
    const minCellSize = isMobile ? 1 : 4;
    const clamped = Math.max(minCellSize, dimensionLimit);
    return Math.min(canvasPixelSize, clamped);
  }, [
    availableHeight,
    availableWidth,
    canvasPixelSize,
    gridHeight,
    gridWidth,
    isMobile,
    viewportWidth,
  ]);
  const displayCellSize = useMemo(
    () => baseCellSize * zoomScale,
    [baseCellSize, zoomScale],
  );
  const contentWidth = gridWidth * displayCellSize;
  const contentHeight = gridHeight * displayCellSize;
  const renderOffsetX =
    canvasViewport.width > 0 && contentWidth > 0 && contentWidth <= canvasViewport.width
      ? (canvasViewport.width - contentWidth) / 2
      : 0;
  const renderOffsetY =
    canvasViewport.height > 0 && contentHeight > 0 && contentHeight <= canvasViewport.height
      ? (canvasViewport.height - contentHeight) / 2
      : 0;
  const scrollOriginX = contentWidth <= canvasViewport.width ? 0 : canvasScroll.x;
  const scrollOriginY = contentHeight <= canvasViewport.height ? 0 : canvasScroll.y;

  const setCanvasScrollClamped = useCallback(
    (
      next:
        | { x: number; y: number }
        | ((previous: { x: number; y: number }) => { x: number; y: number }),
    ) => {
      setCanvasScroll((prev) => {
        const resolved =
          typeof next === "function" ? next(prev) : (next as { x: number; y: number });
        const maxX = Math.max(
          0,
          gridWidth * displayCellSize - canvasViewport.width,
        );
        const maxY = Math.max(
          0,
          gridHeight * displayCellSize - canvasViewport.height,
        );
        const nextX =
          maxX === 0 ? 0 : Math.min(Math.max(0, resolved.x ?? 0), maxX);
        const nextY =
          maxY === 0 ? 0 : Math.min(Math.max(0, resolved.y ?? 0), maxY);
        if (prev.x === nextX && prev.y === nextY) {
          return prev;
        }
        return { x: nextX, y: nextY };
      });
    },
    [canvasViewport.height, canvasViewport.width, displayCellSize, gridHeight, gridWidth],
  );

  const handleViewportResize = useCallback((size: { width: number; height: number }) => {
    setCanvasViewport((prev) =>
      prev.width === size.width && prev.height === size.height ? prev : size,
    );
  }, []);

  const centerPixelInView = useCallback(
    (index: number) => {
      if (displayCellSize <= 0 || gridWidth <= 0 || gridHeight <= 0) return;
      if (canvasViewport.width <= 0 || canvasViewport.height <= 0) return;
      if (index < 0 || index >= gridWidth * gridHeight) return;
      setCanvasScrollClamped(() => {
        const x = index % gridWidth;
        const y = Math.floor(index / gridWidth);
        const targetX =
          x * displayCellSize + displayCellSize / 2 - canvasViewport.width / 2;
        const targetY =
          y * displayCellSize + displayCellSize / 2 - canvasViewport.height / 2;
        return { x: targetX, y: targetY };
      });
    },
    [
      canvasViewport.height,
      canvasViewport.width,
      displayCellSize,
      gridHeight,
      gridWidth,
      setCanvasScrollClamped,
    ],
  );

  useLayoutEffect(() => {
    if (zoomFocusIndexRef.current === null) {
      return;
    }
    const targetIndex = zoomFocusIndexRef.current;
    zoomFocusIndexRef.current = null;
    centerPixelInView(targetIndex);
  }, [centerPixelInView, displayCellSize]);

  useEffect(() => {
    setCanvasScrollClamped((previous) => previous);
  }, [
    canvasViewport.height,
    canvasViewport.width,
    displayCellSize,
    gridHeight,
    gridWidth,
    setCanvasScrollClamped,
  ]);

  useEffect(() => {
    activeLayerPixelsRef.current = activeLayerPixels;
  }, [activeLayerPixels]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    const currentLayer = layers.find((layer) => layer.id === activeLayerId);
    if (!currentLayer) return;
    const currentPixels = activeLayerPixelsRef.current;
    if (
      currentPixels === currentLayer.pixels ||
      !currentPixels ||
      !arePixelsEqual(currentPixels, currentLayer.pixels)
    ) {
      const cloned = currentLayer.pixels.slice();
      activeLayerPixelsRef.current = cloned;
      setActiveLayerPixelsState(cloned);
    }
  }, [activeLayerId, layers]);

  useEffect(() => {
    const composed = composeLayers(layers, totalCells);
    compositePixelsRef.current = composed;
    setCompositePixels(composed);
  }, [layers, totalCells]);

  useEffect(() => {
    const prev = prevDimensionsRef.current;
    if (prev.width === gridWidth && prev.height === gridHeight) {
      return;
    }

    const copyWidth = Math.min(prev.width, gridWidth);
    const copyHeight = Math.min(prev.height, gridHeight);

    setLayers((prevLayers) => {
      const nextLayers = prevLayers.map((layer) => {
        const nextPixels = new Array(totalCells).fill(null) as PixelValue[];
        for (let y = 0; y < copyHeight; y += 1) {
          for (let x = 0; x < copyWidth; x += 1) {
            const oldIndex = y * prev.width + x;
            const newIndex = y * gridWidth + x;
            nextPixels[newIndex] = layer.pixels[oldIndex] ?? null;
          }
        }
        return {
          ...layer,
          pixels: nextPixels,
        };
      });
      layersRef.current = nextLayers;
      const activeLayer = nextLayers.find(
        (layer) => layer.id === activeLayerId,
      );
      if (activeLayer) {
        const cloned = activeLayer.pixels.slice();
        activeLayerPixelsRef.current = cloned;
        setActiveLayerPixelsState(cloned);
      }
      return nextLayers;
    });

    prevDimensionsRef.current = { width: gridWidth, height: gridHeight };
    undoStackRef.current = [];
    redoStackRef.current = [];
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    setCanUndo(false);
    setCanRedo(false);
    setHoverIndexIfChanged(null);
  }, [
    activeLayerId,
    gridHeight,
    gridWidth,
    setCanRedo,
    setCanUndo,
    setHoverIndexIfChanged,
    totalCells,
  ]);

  useEffect(() => {
    const baseDimension = 32;
    const basePixelSize = 16;
    const largestDimension = Math.max(gridWidth, gridHeight);
    const targetSize = Math.max(
      4,
      Math.round((baseDimension / largestDimension) * basePixelSize),
    );
    let closest = CANVAS_PIXEL_SIZE_OPTIONS[0];
    let smallestDiff = Math.abs(closest - targetSize);
    for (const option of CANVAS_PIXEL_SIZE_OPTIONS) {
      const diff = Math.abs(option - targetSize);
      if (diff < smallestDiff) {
        closest = option;
        smallestDiff = diff;
      }
    }
    setCanvasPixelSize((prev) => (prev === closest ? prev : closest));
  }, [gridHeight, gridWidth, setCanvasPixelSize]);

  useEffect(() => {
    if (typeof window === "undefined" || !gridWrapperRef.current) {
      return;
    }
    const updateSize = () => {
      const wrapper = gridWrapperRef.current;
      if (!wrapper) return;
      const measuredWidth = wrapper.clientWidth;
      const parentWidth =
        wrapper.parentElement?.clientWidth ?? measuredWidth;
      const measuredHeight = wrapper.clientHeight;
      const parentHeight =
        wrapper.parentElement?.clientHeight ?? measuredHeight;

      setAvailableWidth(parentWidth);

      wrapperParentWidthRef.current = parentWidth;

      setAvailableHeight(parentHeight);

      wrapperParentHeightRef.current = parentHeight;
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



  const applySnapshot = useCallback(
    (snapshot: LayerSnapshot) => {
      const restoredLayers = cloneLayers(snapshot.layers, totalCells);
      layersRef.current = restoredLayers;
      setLayers(restoredLayers);
      const nextActiveId = restoredLayers.some(
        (layer) => layer.id === snapshot.activeLayerId,
      )
        ? snapshot.activeLayerId
        : restoredLayers[restoredLayers.length - 1]?.id;
      if (nextActiveId) {
        setActiveLayerId(nextActiveId);
      }
      const targetLayer = restoredLayers.find(
        (layer) => layer.id === (nextActiveId ?? snapshot.activeLayerId),
      );
      if (targetLayer) {
        const cloned = targetLayer.pixels.slice();
        activeLayerPixelsRef.current = cloned;
        setActiveLayerPixelsState(cloned);
      }
    },
    [setActiveLayerPixelsState, totalCells],
  );

  const recordSnapshot = useCallback(() => {
    const undoStack = undoStackRef.current;
    const snapshot: LayerSnapshot = {
      layers: cloneLayers(layersRef.current, totalCells),
      activeLayerId,
    };
    const lastSnapshot = undoStack[undoStack.length - 1];
    if (
      lastSnapshot &&
      lastSnapshot.activeLayerId === snapshot.activeLayerId &&
      areLayersEqual(lastSnapshot.layers, snapshot.layers)
    ) {
      return;
    }
    if (undoStack.length === MAX_HISTORY) {
      undoStack.shift();
    }
    undoStack.push(snapshot);
    updateHistoryState();
  }, [activeLayerId, totalCells, updateHistoryState]);

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
    const currentState: LayerSnapshot = {
      layers: cloneLayers(layersRef.current, totalCells),
      activeLayerId,
    };
    if (
      lastSnapshot &&
      lastSnapshot.activeLayerId === currentState.activeLayerId &&
      areLayersEqual(lastSnapshot.layers, currentState.layers)
    ) {
      undoStack.pop();
    }
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [activeLayerId, totalCells, updateHistoryState]);

  const undo = useCallback(() => {
    if (actionInProgressRef.current) return;
    const undoStack = undoStackRef.current;
    if (!undoStack.length) return;
    const previous = undoStack.pop();
    if (!previous) return;
    const currentSnapshot: LayerSnapshot = {
      layers: cloneLayers(layersRef.current, totalCells),
      activeLayerId,
    };
    if (redoStackRef.current.length === MAX_HISTORY) {
      redoStackRef.current.shift();
    }
    redoStackRef.current.push(currentSnapshot);
    applySnapshot(previous);
    setHoverIndexIfChanged(null);
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [activeLayerId, applySnapshot, setHoverIndexIfChanged, totalCells, updateHistoryState]);

  const redo = useCallback(() => {
    if (actionInProgressRef.current) return;
    const redoStack = redoStackRef.current;
    if (!redoStack.length) return;
    const next = redoStack.pop();
    if (!next) return;
    const currentSnapshot: LayerSnapshot = {
      layers: cloneLayers(layersRef.current, totalCells),
      activeLayerId,
    };
    const undoStack = undoStackRef.current;
    if (undoStack.length === MAX_HISTORY) {
      undoStack.shift();
    }
    undoStack.push(currentSnapshot);
    applySnapshot(next);
    setHoverIndexIfChanged(null);
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [activeLayerId, applySnapshot, setHoverIndexIfChanged, totalCells, updateHistoryState]);

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
      const centerX = centerIndex % gridWidth;
      const centerY = Math.floor(centerIndex / gridWidth);
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

          if (!isInBounds(x, y)) {
            continue;
          }

          indices.push(coordsToIndex(x, y));
        }
      }

      return indices;
    },
    [brushShape, brushSize, coordsToIndex, gridWidth, isInBounds],
  );

  const applyBrush = useCallback(
    (index: number, value: PixelValue) => {
      const indices = computeBrushIndices(index);
      if (indices.length === 0) return;

      let changed = false;
      setActiveLayerPixels((prev) => {
        const next = [...prev];

        for (const target of indices) {
          if (next[target] === value) continue;
          next[target] = value;
          changed = true;
        }

        if (!changed) {
          return prev;
        }

        return next;
      });

      if (changed) {
        actionModifiedRef.current = true;
      }
    },
    [computeBrushIndices, setActiveLayerPixels],
  );

  const applyLinePath = useCallback(
    (path: number[], value: PixelValue) => {
      if (!path.length) return;
      const current = activeLayerPixelsRef.current;
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

      actionModifiedRef.current = true;
      setActiveLayerPixels(next);
    },
    [computeBrushIndices, setActiveLayerPixels],
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

  const computeLineIndices = useCallback(
    (startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) {
        return [startIndex];
      }

      let { x: x0, y: y0 } = indexToCoords(startIndex);
      const { x: x1, y: y1 } = indexToCoords(endIndex);

      const result: number[] = [];

      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        if (isInBounds(x0, y0)) {
          result.push(coordsToIndex(x0, y0));
        }
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
    },
    [coordsToIndex, indexToCoords, isInBounds],
  );

  const updateShiftLinePreview = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>, targetIndex: number | null) => {
      const supportsShiftLine = tool === "pencil" || tool === "eraser";
      const clearPreview = () =>
        setPathPreview((prev) => (prev === null ? prev : null));

      if (!supportsShiftLine) {
        clearPreview();
        return;
      }

      if (isDrawingRef.current || !previewToolEffects) {
        if (!isDrawingRef.current) {
          clearPreview();
        }
        return;
      }

      if (!event.shiftKey || lastPointedIndex === null || targetIndex === null) {
        clearPreview();
        return;
      }

      const isErase =
        tool === "eraser" ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        (typeof event.buttons === "number" && (event.buttons & 2) === 2);

      setDrawValue(isErase ? null : activeColor);
      const path = computeLineIndices(lastPointedIndex, targetIndex);
      setPathPreview(buildLinePreview(path));
    },
    [
      activeColor,
      buildLinePreview,
      computeLineIndices,
      lastPointedIndex,
      previewToolEffects,
      setDrawValue,
      tool,
    ],
  );

  const startStroke = useCallback(
    (resolved: ResolvedPointer, nextValue: PixelValue) => {
      isDrawingRef.current = true;
      setDrawValue(nextValue);
      lastPaintedIndexRef.current = resolved.index;
      applyBrush(resolved.index, nextValue);
    },
    [applyBrush, setDrawValue],
  );

  const computeShapeCells = useCallback(
    (startIndex: number, endIndex: number, shape: ShapeKind, filled: boolean) => {
      const { x: startX, y: startY } = indexToCoords(startIndex);
      const { x: endX, y: endY } = indexToCoords(endIndex);

      const minX = Math.max(0, Math.min(startX, endX));
      const maxX = Math.min(gridWidth - 1, Math.max(startX, endX));
      const minY = Math.max(0, Math.min(startY, endY));
      const maxY = Math.min(gridHeight - 1, Math.max(startY, endY));
      const topToBottom = startY <= endY;

      const width = Math.max(1, maxX - minX + 1);
      const height = Math.max(1, maxY - minY + 1);

      const cells: number[] = [];

      const pushCell = (x: number, y: number) => {
        if (!isInBounds(x, y)) return;
        cells.push(coordsToIndex(x, y));
      };

      const addSquare = () => {
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            pushCell(x, y);
          }
        }
      };

      const addCircle = () => {
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
      };

      const addTriangle = () => {
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
      };

      if (shape === "square") {
        addSquare();
      } else if (shape === "circle") {
        addCircle();
      } else {
        addTriangle();
      }

      if (filled) {
        return cells;
      }

      const perimeter = new Set<number>();
      const cellSet = new Set(cells);
      const neighborOffsets = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];

      for (const cell of cells) {
        const { x, y } = indexToCoords(cell);
        for (const { dx, dy } of neighborOffsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (!isInBounds(nx, ny) || !cellSet.has(coordsToIndex(nx, ny))) {
            perimeter.add(cell);
            break;
          }
        }
      }

      return Array.from(perimeter);
    },
    [coordsToIndex, gridHeight, gridWidth, indexToCoords, isInBounds],
  );

  const handleCreateLayer = useCallback(() => {
    recordSnapshot();
    redoStackRef.current = [];
    const newLayer: Layer = {
      id: createLayerId(),
      name: generateLayerName(layersRef.current),
      pixels: new Array(totalCells).fill(null) as PixelValue[],
      visible: true,
    };
    const nextLayers = [...layersRef.current, newLayer];
    layersRef.current = nextLayers;
    setLayers(nextLayers);
    setActiveLayerId(newLayer.id);
    setPathPreview(null);
    setHoverIndexIfChanged(null);
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [recordSnapshot, setHoverIndexIfChanged, totalCells, updateHistoryState, setPathPreview]);

  const handleDeleteLayer = useCallback(
    (layerId: string) => {
      const currentLayers = layersRef.current;
      if (currentLayers.length <= 1) {
        return;
      }
      if (!currentLayers.some((layer) => layer.id === layerId)) {
        return;
      }
      recordSnapshot();
      redoStackRef.current = [];
      const nextLayers = currentLayers.filter((layer) => layer.id !== layerId);
      if (!nextLayers.length) return;
      layersRef.current = nextLayers;
      let nextActiveId = activeLayerId;
      if (
        layerId === activeLayerId ||
        !nextLayers.some((layer) => layer.id === activeLayerId)
      ) {
        nextActiveId = nextLayers[nextLayers.length - 1].id;
      }
      setLayers(nextLayers);
      setActiveLayerId(nextActiveId);
      setPathPreview(null);
      setHoverIndexIfChanged(null);
      actionModifiedRef.current = false;
      actionInProgressRef.current = false;
      updateHistoryState();
    },
    [activeLayerId, recordSnapshot, setHoverIndexIfChanged, setPathPreview, updateHistoryState],
  );

  const handleToggleLayerVisibility = useCallback(
    (layerId: string) => {
      if (!layersRef.current.some((layer) => layer.id === layerId)) {
        return;
      }
      recordSnapshot();
      redoStackRef.current = [];
      const nextLayers = layersRef.current.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      );
      layersRef.current = nextLayers;
      setLayers(nextLayers);
      actionModifiedRef.current = false;
      actionInProgressRef.current = false;
      updateHistoryState();
    },
    [recordSnapshot, updateHistoryState],
  );

  const handleReorderLayers = useCallback(
    (fromIndex: number, toIndex: number) => {
      const currentLayers = layersRef.current;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentLayers.length ||
        toIndex >= currentLayers.length
      ) {
        return;
      }
      recordSnapshot();
      redoStackRef.current = [];
      const nextLayers = [...currentLayers];
      const [moved] = nextLayers.splice(fromIndex, 1);
      nextLayers.splice(toIndex, 0, moved);
      layersRef.current = nextLayers;
      setLayers(nextLayers);
      actionModifiedRef.current = false;
      actionInProgressRef.current = false;
      updateHistoryState();
    },
    [recordSnapshot, updateHistoryState],
  );

  const handleSelectLayer = useCallback(
    (layerId: string) => {
      if (layerId === activeLayerId) return;
      if (!layersRef.current.some((layer) => layer.id === layerId)) {
        return;
      }
      setActiveLayerId(layerId);
      setPathPreview(null);
      setHoverIndexIfChanged(null);
    },
    [activeLayerId, setHoverIndexIfChanged],
  );

  const traceWorldSegment = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const cells: number[] = [];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      let steps = distance / RESAMPLE_STEP;
      if (!Number.isFinite(steps)) {
        steps = 0;
      }
      steps = Math.min(MAX_SEGMENT_STEPS, Math.max(1, Math.ceil(steps)));
      let previousIndex: number | null = null;

      for (let step = 0; step <= steps; step += 1) {
        const t = steps === 0 ? 0 : step / steps;
        const sampleX = from.x + dx * t;
        const sampleY = from.y + dy * t;
        const cellX = Math.floor(sampleX);
        const cellY = Math.floor(sampleY);
        if (!isInBounds(cellX, cellY)) continue;
        const currentIndex = coordsToIndex(cellX, cellY);
        if (previousIndex === null) {
          cells.push(currentIndex);
          previousIndex = currentIndex;
          continue;
        }
        if (currentIndex === previousIndex) {
          continue;
        }
        const link = computeLineIndices(previousIndex, currentIndex);
        for (let pos = 1; pos < link.length; pos += 1) {
          cells.push(link[pos]);
        }
        previousIndex = currentIndex;
      }

      return cells;
    },
    [computeLineIndices, coordsToIndex, isInBounds],
  );

  const appendStrokePoint = useCallback(
    (worldPoint: { x: number; y: number }) => {
      const worldPoints = strokeWorldPointsRef.current;
      const applied = strokeAppliedCellsRef.current;
      if (!worldPoints || !applied) return;
      const lastPoint = worldPoints[worldPoints.length - 1];
      if (
        lastPoint &&
        Math.hypot(lastPoint.x - worldPoint.x, lastPoint.y - worldPoint.y) < 0.01
      ) {
        return;
      }
      worldPoints.push(worldPoint);
      if (lastPoint) {
        const segmentCells = traceWorldSegment(lastPoint, worldPoint);
        if (segmentCells.length) {
          const newCells: number[] = [];
          for (const cell of segmentCells) {
            if (applied.has(cell)) continue;
            applied.add(cell);
            newCells.push(cell);
          }
          if (previewToolEffects) {
            const previewSet = new Set(applied);
            setPathPreview(previewSet);
          }
        }
      }
    },
    [previewToolEffects, setPathPreview, traceWorldSegment],
  );

  const commitStrokeBuffer = useCallback(
    (value: PixelValue) => {
      const applied = strokeAppliedCellsRef.current;
      if (!applied || applied.size === 0) return;
      const targetCells = new Set<number>();
      for (const baseCell of applied) {
        const indices = computeBrushIndices(baseCell);
        for (const idx of indices) {
          targetCells.add(idx);
        }
      }
      if (!targetCells.size) return;
      setActiveLayerPixels((prev) => {
        const next = [...prev];
        let changed = false;
        targetCells.forEach((idx) => {
          if (next[idx] !== value) {
            next[idx] = value;
            changed = true;
          }
        });
        if (!changed) {
          return prev;
        }
        actionModifiedRef.current = true;
        return next;
      });
    },
    [computeBrushIndices, setActiveLayerPixels],
  );

  const stopStroke = useCallback(() => {
    isDrawingRef.current = false;
    lastPaintedIndexRef.current = null;
    strokeWorldPointsRef.current = null;
    strokeAppliedCellsRef.current = null;
    activePointerIdRef.current = null;
    setDragStartIndex(null);
    setPathPreview(null);
    pointerQueueRef.current.length = 0;
    if (pointerRAFRef.current !== null) {
      window.cancelAnimationFrame(pointerRAFRef.current);
      pointerRAFRef.current = null;
    }
    finalizeAction();
  }, [finalizeAction]);

  const floodFill = useCallback((startIndex: number, fillValue: PixelValue) => {
    let changed = false;
    setActiveLayerPixels((prev) => {
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

        const { x, y } = indexToCoords(index);

        const neighbors = [
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y - 1 },
          { x, y: y + 1 },
        ];

        for (const { x: nx, y: ny } of neighbors) {
          if (!isInBounds(nx, ny)) continue;
          stack.push(coordsToIndex(nx, ny));
        }
      }

      if (!changed) {
        return prev;
      }

      return next;
    });

    if (changed) {
      actionModifiedRef.current = true;
    }
  }, [coordsToIndex, indexToCoords, isInBounds, setActiveLayerPixels]);

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

  const resolvePositionFromClientPoint = useCallback(
    (clientX: number, clientY: number, options?: { clamp?: boolean }) => {
      if (!gridRef.current || displayCellSize <= 0) return null;
      const rect = gridRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      if (!Number.isFinite(relativeX) || !Number.isFinite(relativeY)) {
        return null;
      }
      const contentMinX = renderOffsetX;
      const contentMinY = renderOffsetY;
      const contentMaxX = renderOffsetX + contentWidth;
      const contentMaxY = renderOffsetY + contentHeight;
      let adjustedX = relativeX;
      let adjustedY = relativeY;
      const isOutside =
        relativeX < contentMinX ||
        relativeY < contentMinY ||
        relativeX > contentMaxX ||
        relativeY > contentMaxY;
      if (isOutside) {
        if (!options?.clamp) {
          return null;
        }
        adjustedX = Math.min(Math.max(relativeX, contentMinX), contentMaxX);
        adjustedY = Math.min(Math.max(relativeY, contentMinY), contentMaxY);
      }
      const worldX = scrollOriginX + (adjustedX - renderOffsetX);
      const worldY = scrollOriginY + (adjustedY - renderOffsetY);
      return {
        x: worldX / displayCellSize,
        y: worldY / displayCellSize,
      };
    },
    [
      contentHeight,
      contentWidth,
      displayCellSize,
      renderOffsetX,
      renderOffsetY,
      scrollOriginX,
      scrollOriginY,
    ],
  );

  type ResolvedPointer = {
    index: number;
    cellX: number;
    cellY: number;
    position: { x: number; y: number };
  };

  const resolvePointerFromClientPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      options?: { clamp?: boolean },
    ): ResolvedPointer | null => {
      const position = resolvePositionFromClientPoint(clientX, clientY, options);
      if (!position) return null;
      const cellX = Math.floor(position.x);
      const cellY = Math.floor(position.y);
      if (!isInBounds(cellX, cellY)) return null;
      return {
        index: coordsToIndex(cellX, cellY),
        cellX,
        cellY,
        position,
      };
    },
    [coordsToIndex, isInBounds, resolvePositionFromClientPoint],
  );

  const resolvePointerFromPointerEvent = useCallback(
    (event: ReactPointerEvent<Element>, options?: { clamp?: boolean }) =>
      resolvePointerFromClientPoint(event.clientX, event.clientY, options),
    [resolvePointerFromClientPoint],
  );

  const resolveIndexFromPointerEvent = useCallback(
    (event: ReactPointerEvent<Element>, options?: { clamp?: boolean }) =>
      resolvePointerFromClientPoint(event.clientX, event.clientY, options)?.index ?? null,
    [resolvePointerFromClientPoint],
  );

  const flushPointerQueue = useCallback(function flushPointerQueueInternal() {
    pointerRAFRef.current = null;
    if (!isDrawingRef.current) {
      pointerQueueRef.current.length = 0;
      return;
    }
    const pending = pointerQueueRef.current.splice(0, pointerQueueRef.current.length);
    let lastIndex: number | null = null;
    for (const point of pending) {
      const resolved = resolvePointerFromClientPoint(point.x, point.y, {
        clamp: true,
      });
      if (!resolved) continue;
      appendStrokePoint(resolved.position);
      lastIndex = resolved.index;
    }
    if (lastIndex !== null) {
      setHoverIndexIfChanged(lastIndex);
    }
    if (pointerQueueRef.current.length) {
      pointerRAFRef.current = window.requestAnimationFrame(
        flushPointerQueueInternal,
      );
    }
  }, [appendStrokePoint, resolvePointerFromClientPoint, setHoverIndexIfChanged]);

  const enqueuePointerPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof window === "undefined") return;
      pointerQueueRef.current.push({ x: clientX, y: clientY });
      if (pointerRAFRef.current === null) {
        pointerRAFRef.current = window.requestAnimationFrame(flushPointerQueue);
      }
    },
    [flushPointerQueue],
  );

  const processDrawingSamples = useCallback(
    (samples: PointerEvent[]) => {
      for (const sample of samples) {
        enqueuePointerPosition(sample.clientX, sample.clientY);
      }
    },
    [enqueuePointerPosition],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleGlobalPointerMove = (event: PointerEvent) => {
      if (!isDrawingRef.current) return;
      if (tool === "line" || tool === "shape") {
        return;
      }
      if (
        activePointerIdRef.current !== null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      const coalesced =
        typeof event.getCoalescedEvents === "function"
          ? event.getCoalescedEvents()
          : [];
      const samples =
        coalesced.length > 0 ? [...coalesced, event] : [event];
      processDrawingSamples(samples);
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
    };
  }, [processDrawingSamples, tool]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>, index: number) => {
      event.preventDefault();
      const resolved = resolvePointerFromPointerEvent(event, { clamp: true });
      const pointerIndex = resolved?.index ?? index;
      const pointerData: ResolvedPointer =
        resolved ?? {
          index: pointerIndex,
          cellX: pointerIndex % gridWidth,
          cellY: Math.floor(pointerIndex / gridWidth),
          position: { x: pointerIndex % gridWidth + 0.5, y: Math.floor(pointerIndex / gridWidth) + 0.5 },
        };

      setHoverIndexIfChanged(pointerIndex);
      pointerQueueRef.current.length = 0;
      if (pointerRAFRef.current !== null) {
        window.cancelAnimationFrame(pointerRAFRef.current);
        pointerRAFRef.current = null;
      }

      if (tool === "magnifier") {
        const direction = event.shiftKey ? "out" : zoomMode;
        zoomFocusIndexRef.current = pointerIndex;
        applyZoom(direction);
        return;
      }

      if (tool === "picker") {
        const currentPixels = compositePixelsRef.current;
        const value = currentPixels[pointerIndex];
        const pickedColor: PaletteColor =
          value === null ? "transparent" : (value as PaletteColor);
        setActiveColor(pickedColor);
        setDrawValue(pickedColor);
        return;
      }

      const isRightClick = event.button === 2;
      const isErase = isRightClick || event.altKey || event.metaKey || event.ctrlKey;
      beginAction();
      if (tool === "bucket") {
        floodFill(pointerIndex, isErase ? null : activeColor);
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
        setDrawValue(strokeColor);
        lastPaintedIndexRef.current = null;
        setDragStartIndex(pointerIndex);
        if (previewToolEffects) {
          const initialPath =
            tool === "line"
              ? computeLineIndices(pointerIndex, pointerIndex)
              : computeShapeCells(pointerIndex, pointerIndex, shapeType, shapeFilled);
          setPathPreview(buildLinePreview(initialPath));
        } else {
          setPathPreview(null);
        }
        return;
      }

      if (event.shiftKey && lastPointedIndex !== null) {
        const line = computeLineIndices(lastPointedIndex, pointerIndex);
        for (let position = 1; position < line.length; position += 1) {
          applyBrush(line[position], strokeColor);
        }
        setDrawValue(strokeColor);
        lastPaintedIndexRef.current = pointerIndex;
        setPathPreview(null);
        return;
      }

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        activePointerIdRef.current = event.pointerId;
      } catch {
        activePointerIdRef.current = event.pointerId;
      }

      if (tool === "pencil" || tool === "eraser") {
        strokeWorldPointsRef.current = [pointerData.position];
        const applied = new Set<number>();
        applied.add(pointerData.index);
        strokeAppliedCellsRef.current = applied;
        if (previewToolEffects) {
          setPathPreview(new Set(applied));
        } else {
          setPathPreview(null);
        }
      } else {
        strokeWorldPointsRef.current = null;
        strokeAppliedCellsRef.current = null;
      }

      startStroke(pointerData, strokeColor);
      if (strokeAppliedCellsRef.current && (tool === "pencil" || tool === "eraser")) {
        strokeAppliedCellsRef.current.add(pointerData.index);
        if (previewToolEffects) {
          setPathPreview(new Set(strokeAppliedCellsRef.current));
        }
      }
    },
    [
      activeColor,
      applyBrush,
      applyZoom,
      beginAction,
      buildLinePreview,
      computeLineIndices,
      computeShapeCells,
      floodFill,
      gridWidth,
      lastPointedIndex,
      previewToolEffects,
      resolvePointerFromPointerEvent,
      setHoverIndexIfChanged,
      setDrawValue,
      shapeFilled,
      shapeType,
      startStroke,
      tool,
      zoomMode,
    ],
  );

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>, index: number) => {
      const resolved = resolvePointerFromPointerEvent(event, {
        clamp: isDrawingRef.current,
      });
      const pointerIndex = resolved?.index ?? index;
      setHoverIndexIfChanged(pointerIndex);
      if (!isDrawingRef.current) {
        updateShiftLinePreview(event, pointerIndex);
        return;
      }
      event.preventDefault();
      if (tool === "line" || tool === "shape") {
        if (dragStartIndex === null) return;
        if (previewToolEffects) {
          const path =
            tool === "line"
              ? computeLineIndices(dragStartIndex, pointerIndex)
              : computeShapeCells(dragStartIndex, pointerIndex, shapeType, shapeFilled);
          setPathPreview(buildLinePreview(path));
        }
        return;
      }
      if (!resolved) return;
      appendStrokePoint(resolved.position);
    },
    [
      buildLinePreview,
      computeLineIndices,
      computeShapeCells,
      appendStrokePoint,
      dragStartIndex,
      previewToolEffects,
      setHoverIndexIfChanged,
      shapeFilled,
      shapeType,
      tool,
      updateShiftLinePreview,
      resolvePointerFromPointerEvent,
    ],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const nativeEvent = event.nativeEvent;
      const coalesced =
        typeof nativeEvent.getCoalescedEvents === "function"
          ? nativeEvent.getCoalescedEvents()
          : [];
      const samples =
        coalesced.length > 0 ? [...coalesced, nativeEvent] : [nativeEvent];

      if (!isDrawingRef.current) {
        const lastSample = samples[samples.length - 1];
        const resolved = resolvePointerFromClientPoint(
          lastSample.clientX,
          lastSample.clientY,
        );
        const pointerIndex = resolved?.index ?? null;
        setHoverIndexIfChanged(pointerIndex);
        updateShiftLinePreview(event, pointerIndex);
        return;
      }
      if (
        activePointerIdRef.current !== null &&
        nativeEvent.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      if (tool === "line" || tool === "shape") {
        if (dragStartIndex === null) return;
        let lastResolved: ResolvedPointer | null = null;
        for (const sample of samples) {
          const sampleResolved = resolvePointerFromClientPoint(
            sample.clientX,
            sample.clientY,
            { clamp: true },
          );
          if (!sampleResolved) continue;
          lastResolved = sampleResolved;
        }
        if (lastResolved === null) return;
        event.preventDefault();
        setHoverIndexIfChanged(lastResolved.index);
        if (previewToolEffects) {
          const path =
            tool === "line"
              ? computeLineIndices(dragStartIndex, lastResolved.index)
              : computeShapeCells(
                dragStartIndex,
                lastResolved.index,
                shapeType,
                shapeFilled,
              );
          setPathPreview(buildLinePreview(path));
        }
        return;
      }

      event.preventDefault();
      processDrawingSamples(samples);
    },
    [
      buildLinePreview,
      computeLineIndices,
      computeShapeCells,
      dragStartIndex,
      previewToolEffects,
      processDrawingSamples,
      resolvePointerFromClientPoint,
      setHoverIndexIfChanged,
      shapeFilled,
      shapeType,
      tool,
      updateShiftLinePreview,
    ],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const wasDragAction = tool === "line" || tool === "shape";
      const capturedPointer = activePointerIdRef.current;
      const releasePointer = typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId);
      const finalize = () => {
        stopStroke();
        setHoverIndexIfChanged(null);
      };
      flushPointerQueue();
      if (tool === "pencil" || tool === "eraser") {
        const resolvedPointer = resolvePointerFromPointerEvent(event, { clamp: true });
        if (resolvedPointer) {
          appendStrokePoint(resolvedPointer.position);
        }
        commitStrokeBuffer(drawValueRef.current);
      }
      const pointerUpIndex = resolveIndexFromPointerEvent(event, { clamp: true });
      setLastPointedIndex(pointerUpIndex ?? hoverIndex ?? lastPointedIndex);

      if (wasDragAction) {
        const eventIndex = resolveIndexFromPointerEvent(event, { clamp: true });
        const endIndex = eventIndex ?? hoverIndex ?? dragStartIndex;
        if (dragStartIndex !== null && endIndex !== null) {
          const path =
            tool === "line"
              ? computeLineIndices(dragStartIndex, endIndex)
              : computeShapeCells(dragStartIndex, endIndex, shapeType, shapeFilled);
          const before = activeLayerPixelsRef.current.slice();
          applyLinePath(path, drawValueRef.current);
          const after = activeLayerPixelsRef.current;
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
      appendStrokePoint,
      applyLinePath,
      computeLineIndices,
      computeShapeCells,
      hoverIndex,
      dragStartIndex,
      lastPointedIndex,
      commitStrokeBuffer,
      flushPointerQueue,
      resolveIndexFromPointerEvent,
      resolvePointerFromPointerEvent,
      setHoverIndexIfChanged,
      shapeFilled,
      shapeType,
      stopStroke,
      tool,
    ],
  );

  const handlePointerLeave = useCallback(() => {
    if (!isDrawingRef.current) {
      setHoverIndexIfChanged(null);
      if (tool === "line" || tool === "shape" || tool === "pencil" || tool === "eraser") {
        setPathPreview(null);
      }
    }
  }, [setHoverIndexIfChanged, tool]);

  // Render matrix once so React keys stay stable.
  const bucketPreview = useMemo(() => {
    if (!previewToolEffects || hoverIndex === null || tool !== "bucket") return null;
    const targetColor = activeLayerPixels[hoverIndex];
    if (targetColor === undefined) return null;

    const visited = new Set<number>();
    const stack = [hoverIndex];
    const region = new Set<number>();

    while (stack.length) {
      const index = stack.pop();
      if (index === undefined || visited.has(index)) continue;
      visited.add(index);

      if (activeLayerPixels[index] !== targetColor) continue;

      region.add(index);

      const { x, y } = indexToCoords(index);

      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ];

      for (const { x: nx, y: ny } of neighbors) {
        if (!isInBounds(nx, ny)) continue;
        stack.push(coordsToIndex(nx, ny));
      }
    }

    return region;
  }, [activeLayerPixels, coordsToIndex, hoverIndex, indexToCoords, isInBounds, previewToolEffects, tool]);

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

  const reset = useCallback(() => {
    const isAlreadyEmpty = compositePixelsRef.current.every(
      (value) => value === null,
    );
    if (isAlreadyEmpty) return;
    recordSnapshot();
    redoStackRef.current = [];
    setLayers((prevLayers) => {
      const clearedLayers = prevLayers.map((layer) => ({
        ...layer,
        pixels: new Array(totalCells).fill(null) as PixelValue[],
      }));
      layersRef.current = clearedLayers;
      const activeLayer = clearedLayers.find(
        (layer) => layer.id === activeLayerId,
      );
      if (activeLayer) {
        const cloned = activeLayer.pixels.slice();
        activeLayerPixelsRef.current = cloned;
        setActiveLayerPixelsState(cloned);
      }
      return clearedLayers;
    });
    setHoverIndexIfChanged(null);
    actionModifiedRef.current = false;
    actionInProgressRef.current = false;
    updateHistoryState();
  }, [activeLayerId, recordSnapshot, setActiveLayerPixelsState, setHoverIndexIfChanged, totalCells, updateHistoryState]);



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
      { label: "Magnifier", key: "Z" },
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

  useEffect(() => {
    if (!isSaveDialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseSaveDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseSaveDialog, isSaveDialogOpen]);

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

  const [isMobileLayersOpen, setIsMobileLayersOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50 lg:min-h-0 lg:h-full lg:max-h-full">
        <section className="border-b border-zinc-900 px-4 py-2 md:px-6">
          <div className="mx-auto max-w-4xl">
            <Toolbox tools={TOOLS} selectedToolId={tool} onSelect={setTool} />
          </div>
        </section>
        <div className="flex flex-1 min-h-0 lg:max-h-full">
          <aside className="hidden md:flex md:w-56 lg:w-60 flex-col border-r border-zinc-900 bg-zinc-950">
            <div className="flex-1 overflow-y-auto p-4">
              <LayersPanel
                layers={layers}
                activeLayerId={activeLayerId}
                onSelectLayer={handleSelectLayer}
                onCreateLayer={handleCreateLayer}
                onDeleteLayer={handleDeleteLayer}
                onToggleVisibility={handleToggleLayerVisibility}
                onReorderLayers={handleReorderLayers}
                layerPreviews={layerPreviews}
              />
            </div>
            <div className="border-t border-zinc-900 p-4">
              <div className="flex h-12 items-end justify-center">
                <Image
                  src="/logos/PixiePaintLogo.png"
                  alt="Pixie Paint Logo"
                  width={110}
                  height={32}
                  priority
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            </div>
          </aside>
          <main className="flex flex-1 min-w-0 flex-col">
            <div className="flex-1 overflow-auto px-3 py-4 md:px-8 lg:max-h-full">
              <div className="flex h-full w-full flex-col items-center justify-center">
                <PixelGrid
                  gridWidth={gridWidth}
                  gridHeight={gridHeight}
                  displayCellSize={displayCellSize}
                  gridWrapperRef={gridWrapperRef}
                  gridRef={gridRef}
                  pixels={compositePixels}
                  showPixelGrid={showPixelGrid}
                  previewToolEffects={previewToolEffects}
                  bucketPreview={bucketPreview}
                  brushPreview={brushPreview}
                  pathPreview={pathPreview}
                drawValueRef={drawValueRef}
                drawValueVersion={drawValueVersion}
                tool={tool}
                wrapperMaxWidth={availableWidth}
                wrapperMaxHeight={availableHeight}
                canvasScroll={canvasScroll}
                onScrollChange={setCanvasScrollClamped}
                onViewportResize={handleViewportResize}
                handlePointerDown={handlePointerDown}
                handlePointerEnter={handlePointerEnter}
                handlePointerMove={handlePointerMove}
                handlePointerUp={handlePointerUp}
                handlePointerLeave={handlePointerLeave}
                />
              </div>
            </div>
            <div className="md:hidden space-y-4 px-4 pb-6">
              <section className="rounded-lg border border-zinc-900 bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsMobileLayersOpen((prev) => !prev)}
                  aria-expanded={isMobileLayersOpen}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-100"
                >
                  <span>Layers</span>
                  <span className="text-lg leading-none">
                    {isMobileLayersOpen ? "−" : "+"}
                  </span>
                </button>
                {isMobileLayersOpen ? (
                  <div className="max-h-80 overflow-y-auto px-4 pb-4">
                    <LayersPanel
                      layers={layers}
                      activeLayerId={activeLayerId}
                      onSelectLayer={handleSelectLayer}
                      onCreateLayer={handleCreateLayer}
                      onDeleteLayer={handleDeleteLayer}
                      onToggleVisibility={handleToggleLayerVisibility}
                      onReorderLayers={handleReorderLayers}
                      layerPreviews={layerPreviews}
                    />
                  </div>
                ) : null}
              </section>
              <section className="rounded-lg border border-zinc-900 bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsMobileSettingsOpen((prev) => !prev)}
                  aria-expanded={isMobileSettingsOpen}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-100"
                >
                  <span>Tool Settings</span>
                  <span className="text-lg leading-none">
                    {isMobileSettingsOpen ? "−" : "+"}
                  </span>
                </button>
                {isMobileSettingsOpen ? (
                  <div className="max-h-80 overflow-y-auto px-4 pb-4">
                    <ToolSettingsPanel
                      currentTool={currentTool}
                      brushSize={brushSize}
                      onBrushSizeChange={setBrushSize}
                      brushShape={brushShape}
                      onBrushShapeChange={setBrushShape}
                      shapeType={shapeType}
                      onShapeTypeChange={setShapeType}
                      shapeFilled={shapeFilled}
                      onShapeFilledChange={setShapeFilled}
                      zoomMode={zoomMode}
                      onZoomModeChange={setZoomMode}
                      paletteThemeId={paletteThemeId}
                      setPaletteThemeId={setPaletteThemeId}
                      currentPalette={currentPalette}
                      drawValueRef={drawValueRef}
                      setActiveColor={setActiveColor}
                      paletteColors={paletteColors}
                      selectedColorStyles={selectedColorStyles}
                    />
                  </div>
                ) : null}
              </section>
            </div>
            <div className="border-t border-zinc-900 px-3 py-3 md:px-8">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={undo}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUndo}
                  aria-label="Undo"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canRedo}
                  aria-label="Redo"
                >
                  Redo
                </button>
                <button
                  type="button"
                  onClick={handleOpenResetDialog}
                  className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 dark:bg-zinc-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleOpenSettingsDialog}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                >
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => setIsHotkeysDialogOpen(true)}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                >
                  Hotkeys
                </button>
                <button
                  type="button"
                  onClick={handleOpenSaveDialog}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                >
                  Save PNG
                </button>
              </div>
            </div>
          </main>
          <aside className="hidden md:block md:w-72 lg:w-80 border-l border-zinc-900 bg-zinc-950 p-6">
            <ToolSettingsPanel
              currentTool={currentTool}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
              brushShape={brushShape}
              onBrushShapeChange={setBrushShape}
              shapeType={shapeType}
              onShapeTypeChange={setShapeType}
              shapeFilled={shapeFilled}
              onShapeFilledChange={setShapeFilled}
              zoomMode={zoomMode}
              onZoomModeChange={setZoomMode}
              paletteThemeId={paletteThemeId}
              setPaletteThemeId={setPaletteThemeId}
              currentPalette={currentPalette}
              drawValueRef={drawValueRef}
              setActiveColor={setActiveColor}
              paletteColors={paletteColors}
              selectedColorStyles={selectedColorStyles}
            />
          </aside>
        </div>
      </div>
      <PixelPencilModals
        isSaveDialogOpen={isSaveDialogOpen}
        handleCloseSaveDialog={handleCloseSaveDialog}
        handleConfirmSave={handleConfirmSave}
        exportScale={exportScale}
        setExportScale={setExportScaleState}
        exportFilename={exportFilename}
        setExportFilename={setExportFilenameState}
        previewDataUrl={previewDataUrl}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        isSettingsDialogOpen={isSettingsDialogOpen}
        handleCloseSettingsDialog={handleCloseSettingsDialog}
        isHotkeysDialogOpen={isHotkeysDialogOpen}
        handleCloseHotkeysDialog={handleCloseHotkeysDialog}
        hotkeys={HOTKEYS_MAP}
        isResetDialogOpen={isResetDialogOpen}
        handleCloseResetDialog={handleCloseResetDialog}
        handleConfirmReset={handleConfirmReset}
      />
    </>
  );
}
