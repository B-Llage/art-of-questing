import Image from "next/image";
import { PixelPencil } from "./components/PixelPencil/PixelPencil";
import { PixelPencilSettingsProvider } from "./components/PixelPencil/PixelPencilSettingsContext";

export default function Home() {
  return (
    <div className="flex min-h-screen justify-center items-center bg-zinc-50 py-5 font-sans dark:bg-black">
      <main className=" w-full h-full max-w-5xl rounded-2xl bg-white px-8 py-5 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="mb-5 flex justify-center">
          <Image
            src="/logos/PixiePaintLogo.png"
            alt="Pixie Paint Logo"
            width={180}
            height={60}
            priority
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <PixelPencilSettingsProvider>
          <PixelPencil />
        </PixelPencilSettingsProvider>
      </main>
    </div>
  );
}
