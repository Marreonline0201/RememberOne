// components/RememberOneLoader.tsx
// RememberOne — "Breathing aura" loading screen (approved Variation A from Claude Design).
// Self-contained: no external CSS. Fills its container.
// Font: "Instrument Sans" is loaded globally via app/globals.css @import.

export default function RememberOneLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Gathering your people"
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100%",
        background: "#fbf6ff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 42,
        overflow: "hidden",
        fontFamily:
          "'Instrument Sans', system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <style>{`
        @keyframes r1aura-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes r1aura-breathe {
          0%, 100% { transform: scale(0.92); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes r1aura-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes r1aura-blink {
          0%, 72%, 100% { opacity: 0.2; }
          36% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .r1aura-halo, .r1aura-mark, .r1aura-dots > span { animation: none !important; }
          .r1aura-halo { transform: scale(1); opacity: 0.9; }
        }
      `}</style>

      {/* Mark + breathing halo */}
      <div
        style={{
          position: "relative",
          width: 230,
          height: 230,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* flowing, breathing gradient halo */}
        <div
          className="r1aura-halo"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "linear-gradient(120deg, #d0f2ff, #dccaff, #d0f2ff)",
            backgroundSize: "220% 220%",
            filter: "blur(30px)",
            animation:
              "r1aura-flow 6.5s linear infinite, r1aura-breathe 4.8s ease-in-out infinite",
          }}
        />
        {/* faint inner ring of light */}
        <div
          style={{
            position: "absolute",
            inset: 34,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)",
          }}
        />
        {/* dark-purple person mark */}
        <div
          className="r1aura-mark"
          style={{ position: "relative", animation: "r1aura-bob 5s ease-in-out infinite" }}
        >
          <svg width={108} height={108} viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <circle cx="48" cy="32" r="16" fill="#482d7c" />
            <path d="M16 82c0-18 14.3-27 32-27s32 9 32 27Z" fill="#482d7c" />
          </svg>
        </div>
      </div>

      {/* microcopy with animated dots */}
      <div
        style={{
          color: "#8b7bb0",
          fontSize: 17,
          letterSpacing: "0.3px",
          display: "inline-flex",
          alignItems: "baseline",
        }}
      >
        Gathering your people
        <span
          className="r1aura-dots"
          aria-hidden="true"
          style={{ display: "inline-flex", width: 14 }}
        >
          <span style={{ animation: "r1aura-blink 1.4s infinite both" }}>.</span>
          <span style={{ animation: "r1aura-blink 1.4s infinite both", animationDelay: "0.18s" }}>.</span>
          <span style={{ animation: "r1aura-blink 1.4s infinite both", animationDelay: "0.36s" }}>.</span>
        </span>
      </div>
    </div>
  );
}
