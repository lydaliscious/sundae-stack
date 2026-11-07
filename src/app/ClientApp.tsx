"use client";

import dynamic from "next/dynamic";

/** The game is browser-only (canvas, WebAudio, camera, MediaPipe), so it never renders on the server. */
const SundaeApp = dynamic(() => import("@/components/SundaeApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#fff1e6] text-[96px] font-bold text-[#ff5f8f]">Sundae Stack</div>
  ),
});

export function ClientApp() {
  return <SundaeApp />;
}
