export interface SelectedColorStyles {
    backgroundColor: string;
    backgroundImage?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
}

interface  SelectedColorProps {
    selectedColorStyles: SelectedColorStyles;
}

export function SelectedColor({ selectedColorStyles }: SelectedColorProps) {

    return (
        <div className="flex flex-col gap-3">
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                  Selected Color
                </span>
                <span
                  className="h-16 w-full rounded-md border border-zinc-300 shadow-inner dark:border-zinc-600"
                  style={selectedColorStyles}
                  aria-label="Selected color preview"
                />
              </div>
    );
}