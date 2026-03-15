"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
          <p style={{ fontFamily: "sans-serif", fontSize: 18, textTransform: "uppercase" }}>
            Something went wrong
          </p>
          <p style={{ color: "#5e7983", fontSize: 13 }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              height: 40,
              padding: "0 24px",
              background: "linear-gradient(to right, #284e72, #482d7c)",
              color: "white",
              border: "none",
              borderRadius: "10px 2px 10px 2px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
