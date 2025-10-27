import { useCallback, useState } from "react";

import { MAX_ZOOM_SCALE } from "../PixelPencil.constants";

export type ZoomMode = "in" | "out";

export function useZoomControls() {
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("in");

  const applyZoom = useCallback((direction: ZoomMode) => {
    setZoomScale((previous) => {
      if (direction === "in") {
        return Math.min(MAX_ZOOM_SCALE, previous + 1);
      }
      return Math.max(1, previous - 1);
    });
  }, []);

  return {
    zoomScale,
    zoomMode,
    setZoomMode,
    applyZoom,
  };
}
