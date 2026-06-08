// Person profile route — thin wrapper. All data loading happens client-side in
// <PersonDetail> (IndexedDB cache offline, /api/people/[id] online), so this
// route does NO server data fetch. That keeps its RSC data-independent, which
// lets the service worker cache it and open ANY person offline.

import { PersonDetail } from "@/components/PersonDetail";

export const metadata = { title: "Person — RememberOne" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PersonPage(props: Props) {
  const { id } = await props.params;
  return <PersonDetail id={id} />;
}
