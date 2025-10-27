import Image from "next/image";

import { PaintTool } from "./PixelPencilTypes";

interface ToolboxProps {
  tools: readonly PaintTool[];
  selectedToolId: PaintTool["id"];
  onSelect: (toolId: PaintTool["id"]) => void;
}

export function Toolbox({ tools, selectedToolId, onSelect }: ToolboxProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {tools.map((option) => {
        const isSelected = option.id === selectedToolId;
        return (
          <button
            key={option.id}
            type="button"
            className={`flex items-center justify-center rounded-full border border-zinc-300 p-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black ${
              isSelected
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
            onClick={() => onSelect(option.id)}
            aria-label={option.label}
            title={option.label}
          >
            <Image
              src={option.icon}
              width={32}
              height={32}
              alt={`${option.label} icon`}
              unoptimized
              style={{ imageRendering: "pixelated" }}
            />
          </button>
        );
      })}
    </div>
  );
}
