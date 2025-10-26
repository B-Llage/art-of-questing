import { RefObject, useMemo } from "react";
import { PixelValue } from "../../PixelPencil";

interface PaletteProps {
    paletteColors: string[];
    setActiveColor: (color: string) => void;
    drawValueRef: RefObject<PixelValue>
}
export function ColorPalette({ paletteColors, setActiveColor, drawValueRef }: PaletteProps) {

    const paletteButtons = useMemo(
        () =>
            paletteColors.map((color) => {
                const isTransparent = color === "transparent";
                return (
                    <button
                        key={color}
                        type="button"
                        aria-label={`Use color ${color}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black"
                        style={{
                            backgroundColor: isTransparent ? "transparent" : color,
                            backgroundImage: isTransparent
                                ? "linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%, #d1d5db), linear-gradient(45deg, #d1d5db 25%, transparent 25%, transparent 75%, #d1d5db 75%, #d1d5db)"
                                : undefined,
                            backgroundSize: isTransparent ? "8px 8px" : undefined,
                            backgroundPosition: isTransparent ? "0 0, 4px 4px" : undefined,
                        }}
                        onClick={() => {
                            setActiveColor(color);
                            drawValueRef.current = color;
                        }}
                    />
                );
            }),
        [paletteColors],
    );

    return (
        <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Palette
            </span>
            <div className="flex flex-wrap gap-3">{paletteButtons}</div>
        </div>
    );
}