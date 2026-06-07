import RememberOneLoader from "@/components/RememberOneLoader";

// Instant loading state for every (dashboard) route. Next.js wraps the dashboard
// page + all nested routes (calendar, meet, account, people/[id]) in one Suspense
// boundary, so this full-screen overlay shows during slow data-fetch navigations.
export default function Loading() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <RememberOneLoader />
    </div>
  );
}
