import { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from "react";

import { BrushShapeSelector } from "./Settings/Tool/BrushShapeSelector";
import { BrushSizeSelector } from "./Settings/Tool/BrushSizeSelector";
import { ColorPalette } from "./Settings/Tool/ColorPalette";
import { PaletteThemeSelector } from "./Settings/Tool/PaletteThemeSelector";
import { SelectedColor } from "./Settings/Tool/SelectedColor";
import { ShapeSelector } from "./Settings/Tool/ShapeSelector";
import { ZoomModeSelector } from "./Settings/Tool/ZoomModeSelector";
import { BRUSH_SHAPES, BRUSH_SIZES, SHAPE_TYPES } from "./PixelPencil.constants";
import { PaintTool, PaletteColor, PaletteTheme, PixelValue, ShapeKind, BrushShape } from "./PixelPencilTypes";
import { ZoomMode } from "./hooks/useZoomControls";

interface ToolSettingsPanelProps {
  currentTool: PaintTool;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushShape: BrushShape;
  onBrushShapeChange: (shape: BrushShape) => void;
  shapeType: ShapeKind;
  onShapeTypeChange: (shape: ShapeKind) => void;
  shapeFilled: boolean;
  onShapeFilledChange: (filled: boolean) => void;
  zoomMode: ZoomMode;
  onZoomModeChange: (mode: ZoomMode) => void;
  paletteThemeId: string;
  setPaletteThemeId: Dispatch<SetStateAction<string>>;
  currentPalette: PaletteTheme;
  drawValueRef: MutableRefObject<PixelValue>;
  setActiveColor: Dispatch<SetStateAction<PaletteColor>>;
  paletteColors: PaletteColor[];
  selectedColorStyles: CSSProperties;
}

export function ToolSettingsPanel({
  currentTool,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
  shapeType,
  onShapeTypeChange,
  shapeFilled,
  onShapeFilledChange,
  zoomMode,
  onZoomModeChange,
  paletteThemeId,
  setPaletteThemeId,
  currentPalette,
  drawValueRef,
  setActiveColor,
  paletteColors,
  selectedColorStyles,
}: ToolSettingsPanelProps) {
  return (
    <div className="flex flex-col h-full gap-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Tool Settings
      </span>

      {currentTool.settings.brushSize && (
        <BrushSizeSelector
          options={BRUSH_SIZES}
          value={brushSize}
          onChange={onBrushSizeChange}
        />
      )}

      {currentTool.settings.brushShape && (
        <BrushShapeSelector
          options={BRUSH_SHAPES}
          value={brushShape}
          onChange={onBrushShapeChange}
        />
      )}

      {currentTool.settings.shapeType && (
        <ShapeSelector
          options={SHAPE_TYPES}
          value={shapeType}
          onChange={onShapeTypeChange}
        />
      )}

      {currentTool.settings.shapeFilled && (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <span className="font-medium">Filled Shape</span>
          <input
            type="checkbox"
            checked={shapeFilled}
            onChange={(event) => onShapeFilledChange(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-600 dark:text-white dark:focus:ring-white"
          />
        </label>
      )}

      {currentTool.settings.zoomMode && (
        <ZoomModeSelector value={zoomMode} onChange={onZoomModeChange} />
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
        <ColorPalette
          paletteColors={paletteColors}
          setActiveColor={setActiveColor}
          drawValueRef={drawValueRef}
        />
      )}

      {currentTool.settings.selectedColor && (
        <SelectedColor selectedColorStyles={selectedColorStyles} />
      )}
    </div>
  );
}
