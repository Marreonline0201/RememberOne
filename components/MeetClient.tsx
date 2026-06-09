"use client";

// Client wrapper for the Log-a-Meeting page. Reads ?personId from the URL on the
// CLIENT (via useSearchParams) and resolves that person's name from the local
// store — so the page works offline and, when the service worker serves the
// cached (query-less) /meet shell for /meet?personId=X, the personId still
// reflects the real URL rather than a value baked into the cached RSC.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationInput } from "@/components/ConversationInput";
import { getCachedPerson } from "@/lib/offline-cache";

export function MeetClient() {
  const searchParams = useSearchParams();
  const personId = searchParams.get("personId") ?? undefined;
  const [personName, setPersonName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!personId) {
      setPersonName(undefined);
      return;
    }
    let active = true;
    void getCachedPerson(personId).then((p) => {
      if (active) setPersonName(p?.name ?? undefined);
    });
    return () => {
      active = false;
    };
  }, [personId]);

  return <ConversationInput personId={personId} personName={personName} />;
}
