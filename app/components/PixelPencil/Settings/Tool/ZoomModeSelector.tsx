interface ZoomModeSelectorProps {
  value: "in" | "out";
  onChange: (mode: "in" | "out") => void;
}

export function ZoomModeSelector({ value, onChange }: ZoomModeSelectorProps) {
  const options: Array<{ id: "in" | "out"; label: string }> = [
    { id: "in", label: "Zoom In" },
    { id: "out", label: "Zoom Out" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Zoom Mode
      </span>
      <div className="flex gap-2">
        {options.map((option) => {
          const isActive = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`flex-1 rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
                isActive
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
