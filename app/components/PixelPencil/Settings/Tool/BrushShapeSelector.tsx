import type { Dispatch, SetStateAction } from "react";
import { BrushShape } from "../../PixelPencilTypes";


interface BrushShapeOption {
    id: BrushShape;
    label: string;
}

interface BrushShapeSelectorProps {
    options: readonly BrushShapeOption[];
    value: BrushShape;
    onChange: Dispatch<SetStateAction<BrushShape>>;
}

export function BrushShapeSelector({ options, value, onChange }: BrushShapeSelectorProps) {
    return (
        <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Brush Shape
            </span>
            <div className="flex flex-wrap gap-3">
                {options.map((shape) => {
                    const isSelected = shape.id === value;
                    return (
                        <button
                            key={shape.id}
                            type="button"
                            className={`rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${isSelected
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                }`}
                            onClick={() => onChange(shape.id)}
                        >
                            {shape.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
