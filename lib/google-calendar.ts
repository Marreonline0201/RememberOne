// Google Calendar OAuth + event fetching/writing
// Uses the googleapis SDK

import { google, type calendar_v3 } from "googleapis";
import type { CalendarEvent, CalendarAttendee } from "@/types/app";

// calendar.events = read AND write on events (covers everything the old
// calendar.readonly allowed for events, plus insert/patch/delete).
// Connections granted under the old readonly scope still work for reads;
// writes are gated by scopeAllowsEventWrites() and prompt a reconnect.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

// Scopes (exact tokens) that permit event writes. Must be an exact match per
// token — a substring check would false-positive on calendar.readonly.
const WRITE_SCOPES = new Set([
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
]);

export function scopeAllowsEventWrites(scope: string | null): boolean {
  if (!scope) return false;
  return scope.split(/\s+/).some((s) => WRITE_SCOPES.has(s));
}

// ============================================================
// OAuth2 client factory
// `redirectUri` is required for the auth-code flow (getAuthUrl /
// exchangeCodeForTokens) and must match what's in Google Cloud Console.
// Refresh & event calls don't use it, so it stays optional.
// ============================================================
export function createOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri
  );
}

// ============================================================
// Generate the Google authorization URL
// ============================================================
export function getAuthUrl(state: string, redirectUri: string): string {
  const oauth2Client = createOAuth2Client(redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",       // always show consent screen to get refresh_token
    state,
  });
}

// ============================================================
// Exchange an authorization code for tokens
// ============================================================
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
  scope: string;
}> {
  const oauth2Client = createOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);

  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
    scope: tokens.scope ?? SCOPES.join(" "),
  };
}

// ============================================================
// Refresh an access token using a stored refresh token
// Returns new access_token and expiry_date
// ============================================================
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expiry_date: number | null;
}> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return {
    access_token: credentials.access_token!,
    expiry_date: credentials.expiry_date ?? null,
  };
}

// ============================================================
// Authed calendar client with auto-refresh (shared by every event call).
// If the access token is expired/near expiry and a refresh token exists, it
// refreshes first and returns the new token so the caller can persist it.
// ============================================================
async function getCalendarClient(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: string | null
): Promise<{ calendar: calendar_v3.Calendar; newAccessToken: string | null }> {
  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    expiry_date: tokenExpiry ? new Date(tokenExpiry).getTime() : undefined,
  });

  let newAccessToken: string | null = null;
  const now = Date.now();
  const expiry = tokenExpiry ? new Date(tokenExpiry).getTime() : 0;
  if (expiry - now < 5 * 60 * 1000 && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    newAccessToken = refreshed.access_token;
    oauth2Client.setCredentials({
      access_token: refreshed.access_token,
      expiry_date: refreshed.expiry_date ?? undefined,
    });
  }

  return {
    calendar: google.calendar({ version: "v3", auth: oauth2Client }),
    newAccessToken,
  };
}

// App-created events carry this private tag so the UI can offer edit/delete
// only on events this app owns (extendedProperties are invisible in Google UI).
export const APP_EVENT_TAG_KEY = "rememberone";

function normalizeEvent(item: calendar_v3.Schema$Event): CalendarEvent {
  const priv = item.extendedProperties?.private ?? {};
  const appCreated = priv[APP_EVENT_TAG_KEY] === "1";
  return {
    id: item.id ?? "",
    summary: item.summary ?? "(No title)",
    description: item.description ?? null,
    location: item.location ?? null,
    start:
      item.start?.dateTime ?? item.start?.date ?? new Date().toISOString(),
    end: item.end?.dateTime ?? item.end?.date ?? new Date().toISOString(),
    attendees: (item.attendees ?? []).map(
      (a): CalendarAttendee => ({
        email: a.email ?? "",
        displayName: a.displayName ?? null,
        responseStatus: a.responseStatus ?? "needsAction",
      })
    ),
    htmlLink: item.htmlLink ?? "",
    appCreated,
    appPersonId: appCreated ? (priv.personId ?? null) : null,
  };
}

// ============================================================
// Fetch upcoming calendar events (next N days)
// ============================================================
export async function fetchUpcomingEvents(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: string | null,
  calendarId = "primary",
  daysAhead = 7,
  maxResults = 50
): Promise<{ events: CalendarEvent[]; newAccessToken: string | null }> {
  const { calendar, newAccessToken } = await getCalendarClient(
    accessToken,
    refreshToken,
    tokenExpiry
  );

  const timeMin = new Date().toISOString();
  const timeMax = new Date(
    Date.now() + daysAhead * 24 * 60 * 60 * 1000
  ).toISOString();

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults,
  });

  const items = response.data.items ?? [];

  const events: CalendarEvent[] = items
    .filter((item) => item.status !== "cancelled")
    .map(normalizeEvent);

  return { events, newAccessToken };
}

// ============================================================
// Event writes (insert / patch / delete) — used by /api/calendar/event.
// The caller builds the request body (start/end/summary/…); these only own
// auth + the Google call.
// ============================================================
export async function insertCalendarEvent(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: string | null,
  calendarId: string,
  requestBody: calendar_v3.Schema$Event
): Promise<{ event: CalendarEvent; newAccessToken: string | null }> {
  const { calendar, newAccessToken } = await getCalendarClient(
    accessToken,
    refreshToken,
    tokenExpiry
  );
  const res = await calendar.events.insert({ calendarId, requestBody });
  return { event: normalizeEvent(res.data), newAccessToken };
}

export async function patchCalendarEvent(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: string | null,
  calendarId: string,
  eventId: string,
  requestBody: calendar_v3.Schema$Event
): Promise<{ event: CalendarEvent; newAccessToken: string | null }> {
  const { calendar, newAccessToken } = await getCalendarClient(
    accessToken,
    refreshToken,
    tokenExpiry
  );
  const res = await calendar.events.patch({ calendarId, eventId, requestBody });
  return { event: normalizeEvent(res.data), newAccessToken };
}

// Google error status, wherever gaxios put it.
function googleErrorStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { code?: number | string; response?: { status?: number } };
  if (typeof e.response?.status === "number") return e.response.status;
  const code = typeof e.code === "string" ? parseInt(e.code, 10) : e.code;
  return typeof code === "number" && !Number.isNaN(code) ? code : null;
}

export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: string | null,
  calendarId: string,
  eventId: string
): Promise<{ newAccessToken: string | null }> {
  const { calendar, newAccessToken } = await getCalendarClient(
    accessToken,
    refreshToken,
    tokenExpiry
  );
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err: unknown) {
    // Already gone (deleted in Google directly, or deleted twice) — that's
    // the outcome the user wanted; don't surface an error.
    const status = googleErrorStatus(err);
    if (status !== 404 && status !== 410) throw err;
  }
  return { newAccessToken };
}
