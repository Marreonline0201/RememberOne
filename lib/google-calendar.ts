// Google Calendar OAuth + event fetching
// Uses the googleapis SDK

import { google } from "googleapis";
import type { CalendarEvent, CalendarAttendee } from "@/types/app";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

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
// Fetch upcoming calendar events (next N days)
// ============================================================
export async function fetchUpcomingEvents(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiry: string | null,
  calendarId = "primary",
  daysAhead = 7
): Promise<{ events: CalendarEvent[]; newAccessToken: string | null }> {
  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    expiry_date: tokenExpiry ? new Date(tokenExpiry).getTime() : undefined,
  });

  // Auto-refresh if token is expired or close to expiry
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

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

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
    maxResults: 50,
  });

  const items = response.data.items ?? [];

  const events: CalendarEvent[] = items
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({
      id: item.id ?? "",
      summary: item.summary ?? "(No title)",
      description: item.description ?? null,
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
    }));

  return { events, newAccessToken };
}
