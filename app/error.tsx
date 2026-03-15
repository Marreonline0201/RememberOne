"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
      <p className="text-[18px] text-black uppercase" style={{ fontFamily: "'Hammersmith One', sans-serif" }}>
        Something went wrong
      </p>
      <p className="text-[13px]" style={{ color: "#5e7983" }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="h-10 px-6 rounded-[10px_2px_10px_2px] text-white text-sm"
        style={{ background: "linear-gradient(to right, #284e72, #482d7c)" }}
      >
        Try again
      </button>
    </div>
  );
}
