// Offline fallback — shown by the service worker when a page that was never
// cached is opened with no connection. Static + public (no auth/data), so it
// can be precached and served entirely offline.

export const metadata = { title: "Offline — RememberOne" };

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4"
      style={{ backgroundColor: "#fbf6ff" }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
        style={{ background: "linear-gradient(135deg, #d0f2ff, #dccaff)" }}
      >
        📡
      </div>
      <h1
        className="text-[22px] uppercase text-black"
        style={{ fontFamily: "'Hammersmith One', sans-serif" }}
      >
        You&apos;re offline
      </h1>
      <p className="text-[13px] max-w-xs leading-relaxed" style={{ color: "#5e7983" }}>
        This page hasn&apos;t been saved for offline yet. Reconnect to load it —
        people you&apos;ve already viewed are still available.
      </p>
      <p className="text-[12px] max-w-xs leading-relaxed" style={{ color: "#5e7983" }}>
        오프라인 상태예요. 이 페이지는 아직 저장되지 않았어요. 연결되면 다시
        불러올 수 있어요.
      </p>
    </div>
  );
}
