// Calendar — a thin wrapper so it renders fully client-side and opens offline.
// CalendarView self-loads people, the calendar-connection flag, and the last-
// synced events from the local store; the dashboard layout's server auth gate
// still protects it online, and offline the cached shell is served.

import { CalendarView } from "@/components/CalendarView";

export const metadata = { title: "Calendar — RememberOne" };

export default function CalendarPage() {
  return <CalendarView />;
}
