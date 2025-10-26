import type { Dispatch, SetStateAction } from "react";

interface ShapeOption<T extends string = string> {
  id: T;
  label: string;
}

interface ShapeSelectorProps<T extends string = string> {
  options: readonly ShapeOption<T>[];
  value: T;
  onChange: Dispatch<SetStateAction<T>>;
}

export function ShapeSelector<T extends string = string>({ options, value, onChange }: ShapeSelectorProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Shape
      </span>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const isSelected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className={`rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
                isSelected
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
