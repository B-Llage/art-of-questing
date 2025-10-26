import type { Dispatch, SetStateAction } from "react";

interface BrushSizeSelectorProps {
    options: readonly number[];
    value: number;
    onChange: Dispatch<SetStateAction<number>>;
}

export function BrushSizeSelector({ options, value, onChange }: BrushSizeSelectorProps) {
    return (
        <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Brush Size
            </span>
            <div className="flex flex-wrap gap-3">
                {options.map((size) => {
                    const isSelected = size === value;
                    return (
                        <button
                            key={size}
                            type="button"
                            className={`rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${isSelected
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                }`}
                            onClick={() => onChange(size)}
                        >
                            {size}px
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
