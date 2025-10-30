"use client";

import {
  useCallback,
  useMemo,
  useState,
  type MouseEvent,
  type DragEvent,
} from "react";

interface LayersPanelProps {
  layers: Array<{ id: string; name: string; visible: boolean }>;
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onCreateLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  layerPreviews: Record<string, string | undefined>;
}

export function LayersPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onCreateLayer,
  onDeleteLayer,
  onToggleVisibility,
  onReorderLayers,
  layerPreviews,
}: LayersPanelProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const canDeleteLayer = layers.length > 1;

  const orderedLayers = useMemo(
    () => [...layers].reverse(),
    [layers],
  );

  const resolveIndex = useCallback(
    (id: string) => layers.findIndex((layer) => layer.id === id),
    [layers],
  );

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLLIElement>, id: string) => {
      setDraggedId(id);
      event.dataTransfer.setData("text/plain", id);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLLIElement>, id: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  }, [dragOverId]);

  const handleDragLeave = useCallback((event: DragEvent<HTMLLIElement>, id: string) => {
    event.preventDefault();
    if (dragOverId === id) {
      setDragOverId(null);
    }
  }, [dragOverId]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLIElement>, id: string) => {
      event.preventDefault();
      const sourceId = draggedId ?? event.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === id) {
        handleDragEnd();
        return;
      }
      const fromIndex = resolveIndex(sourceId);
      const toIndex = resolveIndex(id);
      if (fromIndex === -1 || toIndex === -1) {
        handleDragEnd();
        return;
      }
      onReorderLayers(fromIndex, toIndex);
      handleDragEnd();
    },
    [draggedId, handleDragEnd, onReorderLayers, resolveIndex],
  );

  const handleToggleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, id: string) => {
      event.stopPropagation();
      onToggleVisibility(id);
    },
    [onToggleVisibility],
  );

  const handleDeleteClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, id: string) => {
      event.stopPropagation();
      onDeleteLayer(id);
    },
    [onDeleteLayer],
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Layers
        </span>
        <button
          type="button"
          onClick={onCreateLayer}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
        >
          Add Layer
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {orderedLayers.map((layer) => {
          const isActive = layer.id === activeLayerId;
          const isDragged = layer.id === draggedId;
          const isDragOver = layer.id === dragOverId;
          const actualIndex = resolveIndex(layer.id);
          const orderLabel =
            actualIndex === -1 ? "?" : String(layers.length - actualIndex);
          const previewSrc = layerPreviews[layer.id];
          return (
            <li
              key={layer.id}
              draggable
              onDragStart={(event) => handleDragStart(event, layer.id)}
              onDragOver={(event) => handleDragOver(event, layer.id)}
              onDragLeave={(event) => handleDragLeave(event, layer.id)}
              onDrop={(event) => handleDrop(event, layer.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
                  : "border-zinc-200 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              } ${isDragged ? "opacity-60" : ""} ${
                isDragOver ? "ring-2 ring-black dark:ring-white" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectLayer(layer.id)}
                className="flex flex-1 items-center justify-start gap-3 text-left"
              >
                <div
                  className={`relative h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-zinc-300 dark:border-zinc-600 ${layer.visible ? "" : "opacity-50"}`}
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%, #d1d5db), linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%, #d1d5db)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 4px 4px",
                  }}
                  aria-hidden="true"
                >
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {orderLabel}
                </span>
                <span className="truncate">{layer.name}</span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => handleToggleClick(event, layer.id)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
                    layer.visible
                      ? "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                  aria-pressed={layer.visible}
                >
                  {layer.visible ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={(event) => handleDeleteClick(event, layer.id)}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950 dark:focus-visible:ring-red-400 dark:focus-visible:ring-offset-black"
                  disabled={!canDeleteLayer}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
