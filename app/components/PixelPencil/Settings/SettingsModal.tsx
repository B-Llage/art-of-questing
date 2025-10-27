import { useMemo } from "react";
import {
  CANVAS_PIXEL_SIZE_OPTIONS,
  GRID_DIMENSION_OPTIONS,
  usePixelPencilSettings,
} from "../PixelPencilSettingsContext";


interface SettingsModalProps {
    handleCloseSettingsDialog: () => void;
}

export function SettingsModal( { handleCloseSettingsDialog }: SettingsModalProps) {
    const {
        previewToolEffects,
        setPreviewToolEffects,
        canvasPixelSize,
        setCanvasPixelSize,
        gridWidth,
        setGridWidth,
        gridHeight,
        setGridHeight,
        showPixelGrid,
        setShowPixelGrid,
      } = usePixelPencilSettings();

        const canvasSizeOptions = useMemo(() => {
          const labelMap: Record<(typeof CANVAS_PIXEL_SIZE_OPTIONS)[number], string> = {
            8: "XS",
            13: "Small",
            16: "Medium",
            19: "Large",
            32: "XL",
          };
          return CANVAS_PIXEL_SIZE_OPTIONS.map((size) => ({
            size,
            label: labelMap[size],
          }));
        }, []);

    return <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={handleCloseSettingsDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="settings-dialog-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Pixel Pencil Settings
            </h2>
            <div className="mt-4 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Preview Tool Effects
                  </span>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    Show live tool previews while hovering over the canvas.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={previewToolEffects}
                    onChange={(event) => setPreviewToolEffects(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-600 dark:text-white dark:focus:ring-white"
                  />
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    Enabled
                  </span>
                </label>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Pixel Grid
                  </span>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    Toggle the borders between individual pixels on the canvas.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={showPixelGrid}
                    onChange={(event) => setShowPixelGrid(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-600 dark:text-white dark:focus:ring-white"
                  />
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    Visible
                  </span>
                </label>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Grid Width
                </span>
                <div className="flex flex-wrap gap-3">
                  {GRID_DIMENSION_OPTIONS.map((size) => {
                    const isSelected = size === gridWidth;
                    return (
                      <button
                        key={`grid-width-${size}`}
                        type="button"
                    className={`rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
                          isSelected
                            ? "bg-black text-white dark:border-white dark:bg-white dark:text-black"
                            : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                        onClick={() => setGridWidth(size)}
                      >
                        {size}px
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Grid Height
                </span>
                <div className="flex flex-wrap gap-3">
                  {GRID_DIMENSION_OPTIONS.map((size) => {
                    const isSelected = size === gridHeight;
                    return (
                      <button
                        key={`grid-height-${size}`}
                        type="button"
                    className={`rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
                          isSelected
                            ? "bg-black text-white dark:border-white dark:bg-white dark:text-black"
                            : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                        onClick={() => setGridHeight(size)}
                      >
                        {size}px
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Canvas Pixel Size
                </span>
                <div className="flex flex-wrap gap-3">
                  {canvasSizeOptions.map(({ size, label }) => {
                    const isSelected = size === canvasPixelSize;
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`flex flex-col items-center rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
                          isSelected
                            ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                        onClick={() => setCanvasPixelSize(size)}
                      >
                        <span className="font-medium">{label}</span>
                        <span className="text-xs opacity-80">{size}px</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCloseSettingsDialog}
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>;
}
