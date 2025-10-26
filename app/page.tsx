import { PixelPencil } from "./components/PixelPencil/PixelPencil";
import { PixelPencilSettingsProvider } from "./components/PixelPencil/PixelPencilSettingsContext";

export default function Home() {
  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 py-16 font-sans dark:bg-black">
      <main className=" w-full max-w-5xl rounded-2xl bg-white px-8 py-12 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <PixelPencilSettingsProvider>
          <PixelPencil />
        </PixelPencilSettingsProvider>
      </main>
    </div>
  );
}
