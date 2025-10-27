interface ZoomSensitivitySelectorProps {
  value: number;
  onChange: (next: number) => void;
}

const SENSITIVITY_OPTIONS = [
  { id: 1, label: "High" },
  { id: 2, label: "Medium" },
  { id: 3, label: "Low" },
] as const;

export function ZoomSensitivitySelector({
  value,
  onChange,
}: ZoomSensitivitySelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Scroll Sensitivity
      </span>
      <div className="flex gap-2">
        {SENSITIVITY_OPTIONS.map((option) => {
          const isSelected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`flex-1 rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
                isSelected
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
