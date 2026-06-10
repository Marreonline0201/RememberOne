// Route-level loading skeleton for /people/[id]. Overrides the shared full-screen
// dashboard aura (app/(dashboard)/loading.tsx) with a contextual person-shaped
// skeleton in the content area: the nav stays put and a person-card outline shows
// instead of a full app-reload spinner. Most taps skip this entirely — a
// prefetched person now opens instantly from the router cache
// (experimental.staleTimes.dynamic); this only shows on the rarer network tap
// (card not prefetched yet / cache expired). Mirrors PersonDetail's layout.
export default function Loading() {
  return (
    <div className="w-full max-w-lg mx-auto space-y-5 animate-pulse">
      {/* Header card — avatar + name + chips */}
      <div
        className="p-5"
        style={{
          borderRadius: "10px 2px 10px 2px",
          background: "linear-gradient(52deg, #d0f2ff 0%, #dccaff 100%)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-full shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.55)" }}
          />
          <div className="flex-1 min-w-0 space-y-2 pt-1">
            <div
              className="h-6 w-2/3 rounded"
              style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
            />
            <div
              className="h-3 w-1/3 rounded"
              style={{ backgroundColor: "rgba(255,255,255,0.45)" }}
            />
            <div className="flex gap-1.5 pt-1">
              <div
                className="h-4 w-14 rounded-[5px]"
                style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
              />
              <div
                className="h-4 w-20 rounded-[5px]"
                style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Body blocks */}
      {[0, 1].map((i) => (
        <div
          key={i}
          className="p-4 rounded-[10px_2px_10px_2px] space-y-3"
          style={{ backgroundColor: "#f5f0ff", border: "1px solid #dccaff" }}
        >
          <div className="h-3 w-24 rounded" style={{ backgroundColor: "#e3d8ff" }} />
          <div className="h-10 w-full rounded" style={{ backgroundColor: "#efe8ff" }} />
        </div>
      ))}
    </div>
  );
}
