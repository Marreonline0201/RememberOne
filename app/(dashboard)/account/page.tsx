// Account — a thin wrapper so it renders fully client-side and opens offline.
// AccountPage self-loads the user profile + calendar-connection flag from the
// local store (seeded on the online home load). The dashboard layout's server
// auth gate still protects it online; offline the cached shell is served.

import { AccountPage } from "@/components/AccountPage";

export const metadata = { title: "Account — RememberOne" };

export default function Account() {
  return <AccountPage />;
}
