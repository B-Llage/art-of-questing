import { PixelPencil } from "./components/PixelPencil/PixelPencil";
import { PixelPencilSettingsProvider } from "./components/PixelPencil/context/PixelPencilSettingsContext";

export default function Home() {
  return (
    <PixelPencilSettingsProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-50 antialiased lg:h-screen lg:max-h-screen overflow-hidden">
        <PixelPencil />
      </div>
    </PixelPencilSettingsProvider>
  );
}
