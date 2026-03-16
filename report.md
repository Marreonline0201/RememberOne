# RememberOne — Full App Report

This document explains every part of the RememberOne app in plain language. It covers what the app does, how each screen works, what every feature does behind the scenes, and what outside services are used.

---

## What is RememberOne?

RememberOne is a personal memory assistant app. When you meet someone new, you can tap a microphone button, describe who you met out loud (or type it), and the app uses AI to automatically pull out their name, job, interests, family members, and other details — then saves it all for you. You can look people up later, add more notes about them, see a timeline of when you met, and even get reminders before a scheduled calendar meeting.

The app works both in a web browser and as a native Android/iOS app.

---

## Table of Contents

1. [Screens / Pages](#screens--pages)
2. [Features Explained](#features-explained)
3. [Behind-the-Scenes: API Endpoints](#behind-the-scenes-api-endpoints)
4. [Helper Code (lib/)](#helper-code-lib)
5. [Database — What Gets Saved](#database--what-gets-saved)
6. [Outside Services Used](#outside-services-used)
7. [How Everything Connects (User Flow)](#how-everything-connects-user-flow)
8. [Language Support](#language-support)

---

## Screens / Pages

### Login Page — `/login`
The first screen a new or returning user sees.

- **Sign in with Google** — one tap, uses your existing Google account.
- **Email & Password** — type your email and a password to create an account or sign in.
- On mobile (Android/iOS app), the Google sign-in opens in a browser popup and then returns to the app automatically.
- If you just signed up with email, you'll get a confirmation email. Clicking the link in that email completes your account setup.

---

### Home / People List — `/` (dashboard home)
The main screen after you log in. Shows every person you've saved.

- Each person appears as a card showing their name, when you last met them, key info chips (job, school, etc.), family members, and interests.
- **Search bar** — type any name, keyword, attribute, or family member name to filter the list instantly without reloading.
- **Mic icon on each card** — tap to go directly to the voice input page for that specific person (adds new details to them, doesn't create a new person).
- **Upcoming meeting banner** — if your Google Calendar is connected, a blue banner appears at the top when you have a calendar event soon that matches someone you've saved.
- If you haven't saved anyone yet, an empty state screen appears with a "Log Your First Meeting" button.

---

### Log a Meeting — `/meet`
The voice-input screen for recording who you met.

**Two modes:**

1. **General mode** (`/meet` with no extra parameters) — for logging anyone new or existing. You speak freely, and the AI figures out who you're talking about, extracts their details, and saves them.

2. **Person mode** (`/meet?personId=...`) — reached by tapping "LOG MEETING WITH [Name]" from someone's profile, or tapping the mic icon on a person card. The screen locks to that one person. Everything you say gets added only to their profile (new attributes, family members, meeting log). No new person is ever created here.

**How recording works:**
- On Android/iOS: uses the phone's native speech recognition (microphone icon → tap to start, tap again to stop; transcript appears on screen).
- On web (Chrome/Edge): uses the browser's built-in speech recognition.
- You can tap the mic multiple times — each new recording gets added to the same text box. All recordings together count as one submission.
- You can also just type directly into the text area.
- Once text appears, a "EXTRACT & SAVE" (or "SAVE FOR [Name]" in person mode) button appears. Tap it to send to AI and save.

---

### Person Profile — `/people/[id]`
The full detail page for one saved person. Everything you know about them lives here.

**Sections on this page:**

- **Header card** — avatar (initials), editable name, "Last met X days ago · N meetings total", attribute chips (job, age, school, etc.), interests.
- **LOG MEETING WITH [Name] button** — takes you to `/meet?personId=...` to add new info about this person only.
- **Add Notes** — a panel that opens when you tap it. Lets you record or type additional notes about this person. AI extracts any new facts and adds them to their profile automatically.
- **Edit Details** — shows all saved attributes (job, company, age, etc.) as editable fields. You can change values, delete attributes, or add new ones manually.
- **Family** — shows all saved family members (e.g., "Jake — son") with their own attributes. You can add, edit, or delete family members here.
- **Meetings (N)** — a timeline of every meeting logged with this person, showing the date, location (if captured), and AI-generated summary of what was discussed.
- **Delete button** — permanently deletes this person and all their data.

---

### Calendar — `/calendar`
Shows all your saved meetings grouped by date (most recent first).

- Each date shows the people you met on that day, with their info chips and meeting summary.
- If your Google Calendar is connected, a banner at the top shows upcoming events that match people in your list.
- If no meetings are saved yet, an empty state appears with instructions.

---

### Account — `/account`
Manage your account settings.

- **Profile card** — your name and email at the top.
- **Language** — switch between English and Korean. Tap to expand a selector. Changes take effect everywhere in the app immediately (dates, labels, button text, etc.).
- **Session / Sign Out** — tap the "Sign out" button to log out.
- **Delete Account** — step-by-step instructions for permanently deleting your account and all data. Requires emailing the support address; deletion happens within 30 days.
- **Policy** — links to the Privacy Policy and Child Safety Standards pages.

---

### Privacy Policy — `/privacy`
A standard privacy policy page explaining what data is collected and how it's used. Shown in Korean if your app language is set to Korean.

---

### Child Safety Standards — `/child-safety`
Documents the app's zero-tolerance policy on child safety, reporting procedures, and compliance. Shown in Korean if your app language is set to Korean.

---

## Features Explained

### Voice-to-Profile (AI Extraction)
This is the core feature. You speak naturally ("I met Sarah today. She works at Google as a software engineer. She has a daughter named Emma who is 7.") and the AI:

1. Identifies the person's name ("Sarah").
2. Pulls out structured facts: `Job: Software Engineer`, `Company: Google`.
3. Identifies family members: Emma, relation = daughter, attribute: Age = 7.
4. Figures out the meeting date from words like "today" or "yesterday" and converts it to a date.
5. Saves everything to the database and shows you a preview before you navigate away.

If you already have Sarah saved, the app matches the name and *adds* the new info to her existing profile instead of creating a duplicate.

**Korean support:** If your language is set to Korean and you speak in Korean, the AI stores attribute keys in Korean (e.g., "직업" instead of "Job", "회사" instead of "Company").

---

### Multiple Mic Taps = One Person
You don't have to say everything in one breath. You can:

1. Tap mic → say "I met 철수 today. He's a doctor." → tap to stop.
2. Tap mic again → say "He has a son named 민준." → tap to stop.
3. Both recordings are combined into one submission.

The AI is instructed to treat all sentences as being about the same person — it won't accidentally create separate people from different recording sessions.

---

### Smart Duplicate Prevention
Before saving, the app fetches your existing list of saved people and tells the AI: "These people already exist — if the name matches, use the exact saved name." This prevents the same person being saved twice under a slightly different spelling or romanization (e.g., "Kim Cheolsu" and "김철수" being treated as different people).

---

### Add Notes to Existing Person
From a person's profile, tap "Add notes" to open a panel. You can:
- Record voice notes or type.
- The AI only looks at that specific person — it won't add the info to anyone else.
- New attributes get added; existing ones get updated. A new meeting entry is created in their history.

---

### Live Search
On the home page, the search box filters people in real time as you type. It searches across:
- Person name
- All attribute values (e.g., searching "Google" finds people with Company: Google)
- Family member names
- Notes

---

### Calendar Integration (Google Calendar)
If you connect your Google Calendar:

1. The app reads your upcoming events (next 7 days, read-only).
2. It compares attendee names and event titles against your saved people.
3. If a match is found, a banner appears on the home and calendar pages showing you the event and the matched person's details — so you can quickly review everything you know about them before the meeting.

If the connection token expires or is revoked, the app automatically cleans up the stale connection instead of showing an error.

---

### Language Switching
Changing language in Settings → Language immediately affects:
- All navigation labels (People, Log meeting, Calendar)
- All button text
- All section headers (Edit Details, Family, Interest, etc.)
- All dates (formatted in Korean style: "2024년 3월 15일" instead of "March 15, 2024")
- Relative dates ("어제", "3일 전" instead of "yesterday", "3 days ago")
- Attribute key labels ("직업" instead of "Job", "나이" instead of "Age")
- Policy pages (Privacy Policy and Child Safety pages)
- Empty state messages
- AI instructions: new extractions store attribute names in Korean

The language is saved to your account and remembered across sessions and devices.

---

### Inline Name Editing
On a person's profile, tap their name to edit it directly. Press Enter or click outside to save. The change is reflected immediately without reloading.

---

### Family Members
For each person you can save their relatives with a relation type (son, daughter, spouse, etc.) and their own attributes (e.g., Emma's school, age). Family members can be:
- Added via voice/text when logging a meeting ("He has a daughter named Emma, she's 7")
- Added manually on the profile page
- Edited or deleted from the profile

---

## Behind-the-Scenes: API Endpoints

These are the server-side actions the app performs. You never see these directly, but they power every feature.

| Endpoint | What it does |
|---|---|
| `POST /api/ai/extract` | Receives your voice transcript, sends it to Gemini AI, gets back structured person data, saves it all to the database, returns the saved person IDs |
| `POST /api/people/[id]/notes` | Receives additional notes about one specific person, sends to AI for extraction, merges new info into their profile, adds a new meeting log entry |
| `GET /api/people` | Returns your full list of saved people |
| `POST /api/people` | Creates a new person manually (without AI) |
| `GET /api/people/[id]` | Returns all info for one person (attributes, family, meetings) |
| `PUT /api/people/[id]` | Updates a person's name, notes, or replaces their attributes |
| `DELETE /api/people/[id]` | Permanently deletes a person and everything associated with them |
| `POST /api/people/[id]/attributes` | Adds or updates one attribute (e.g., sets Job = Doctor) |
| `DELETE /api/people/[id]/attributes` | Removes one attribute |
| `POST /api/people/[id]/family` | Adds a new family member |
| `PATCH /api/people/[id]/family/[fmId]` | Updates a family member's name, relation, or notes |
| `DELETE /api/people/[id]/family/[fmId]` | Deletes a family member |
| `GET /api/calendar/connect` | Starts the Google Calendar connection process (opens Google's permission screen) |
| `GET /api/calendar/callback` | Google redirects here after the user grants calendar permission; the app saves the access tokens |
| `GET /api/calendar/events` | Fetches upcoming calendar events, matches them to saved people, returns the results for the alert banner |
| `DELETE /api/calendar/events` | Disconnects your Google Calendar |
| `GET /auth/callback` | Handles email confirmation links (when you verify your email address after signing up) |

---

## Helper Code (lib/)

These are files containing reusable logic used throughout the app.

### `lib/gemini.ts` — AI communication
Handles all communication with Google's Gemini AI model.

- **`extractPeopleFromText`** — Takes your raw transcript text, today's date, your language setting, and your existing saved people's names. Sends it all to Gemini and gets back a structured list of people with their attributes and family members. The AI prompt changes based on language (Korean prompts produce Korean attribute keys). Existing names are included so Gemini can match rather than duplicate.

- **`extractAdditionalInfo`** — Used when adding notes to an existing person. Tells Gemini specifically which person the notes are about and lists their already-known family members, so Gemini only extracts *new* info and doesn't duplicate existing entries.

---

### `lib/people.ts` — Database read/write for people
All the code for reading and saving people data.

- **`getPersonFull`** — Fetches one person with everything: their attributes, all family members and their attributes, and all meeting history. Used on the person profile page.

- **`getAllPeople`** — Fetches a basic list of all your people (just name + id). Used for dropdown lists and AI context.

- **`getAllPeopleFull`** — Fetches all your people with full details in just 5 database queries regardless of how many people you have. Used on the home page and calendar.

- **`saveExtractionResult`** — After AI extracts people from a transcript, this function saves everything. For each person: checks if they already exist (by name), creates them if not, upserts all their attributes, upserts family members, and creates a new meeting log entry.

---

### `lib/google-calendar.ts` — Google Calendar connection
Handles connecting to and reading from Google Calendar.

- **`getAuthUrl`** — Generates the URL that opens Google's "allow access to your calendar" screen.
- **`exchangeCodeForTokens`** — After Google redirects back, this converts the one-time code into access tokens that the app stores.
- **`refreshAccessToken`** — Access tokens expire after an hour. This automatically gets a new one using the stored refresh token.
- **`fetchUpcomingEvents`** — Gets the next 7 days of calendar events. Automatically refreshes the token if needed. If the token is permanently expired or revoked, it returns empty instead of crashing.

---

### `lib/utils.ts` — General utility functions
Small helper functions used everywhere.

- **`formatDate`** — Converts a stored date like `2024-03-15` into a readable label like "March 15, 2024" (or "2024년 3월 15일" in Korean).
- **`formatRelativeDate`** — Converts a date into something like "3 days ago", "yesterday", "today" (or Korean equivalents).
- **`localizeKey`** — Converts English attribute key names into Korean when the app language is Korean. Has a built-in dictionary of ~50 common terms: "Job" → "직업", "Company" → "회사", "Age" → "나이", "University" → "대학교", etc.
- **`capitalize`** — Makes the first letter of a word uppercase.
- **`getInitials`** — Gets initials from a name for the avatar circle (e.g., "John Smith" → "JS").
- **`todayISO`** — Returns today's date as `YYYY-MM-DD`.
- **`eventMentionsPerson`** — Checks if a calendar event title or description contains a saved person's name, used to find upcoming meeting matches.

---

### `lib/i18n.ts` — All translations
Contains every piece of text shown in the app in both English and Korean.

- **`languages`** — A list of supported languages: English (🇺🇸, locale `en-US`) and Korean (🇰🇷, locale `ko-KR`).
- **`getLanguage`** — Returns the full language info for a language code.
- **`translate`** — Given a key like `"meet.tap_to_speak"` and a language code, returns the right translation. Falls back to English if a Korean translation doesn't exist.

---

## Database — What Gets Saved

The app uses a PostgreSQL database (hosted by Supabase). Every user's data is completely isolated — you can only see your own data.

### `people` table
One row per saved person.

| Column | What it stores |
|---|---|
| `id` | Unique ID for this person |
| `user_id` | Which user they belong to |
| `name` | The person's name |
| `notes` | Free-text notes |
| `avatar_url` | Profile picture URL (not currently used) |
| `created_at` / `updated_at` | When the record was created/last changed |

---

### `person_attributes` table
One row per fact about a person. A person can have many attributes.

| Column | What it stores |
|---|---|
| `person_id` | Which person this belongs to |
| `key` | The label (e.g., "Job", "직업", "Company") |
| `value` | The value (e.g., "Doctor", "Google") |

No two attributes on the same person can have the same key. Setting the same key twice updates the value.

---

### `meetings` table
One row per logged meeting.

| Column | What it stores |
|---|---|
| `person_id` | Who was met |
| `raw_input` | The original text/transcript the user submitted |
| `meeting_date` | The date of the meeting (YYYY-MM-DD) |
| `location` | Where it happened (if mentioned) |
| `summary` | AI-generated one-sentence summary |

---

### `family_members` table
One row per family member of a saved person.

| Column | What it stores |
|---|---|
| `person_id` | Which person they belong to |
| `name` | Family member's name |
| `relation` | Relationship type: "son", "daughter", "spouse", etc. |
| `notes` | Free-text notes about them |

---

### `family_member_attributes` table
Same concept as `person_attributes` but for family members.

---

### `calendar_connections` table
Stores the Google Calendar access credentials for each user.

| Column | What it stores |
|---|---|
| `user_id` | Which user this belongs to |
| `provider` | Always "google" |
| `access_token` | Short-lived token for reading calendar |
| `refresh_token` | Long-lived token to get new access tokens |
| `token_expiry` | When the access token expires |
| `calendar_id` | Which calendar to read (default: "primary") |

---

## Outside Services Used

### Supabase
**What it is:** The database and authentication system.

**What it does:**
- Stores all user data (people, meetings, attributes, family, calendar connections).
- Handles login/signup (email+password and Google OAuth).
- Row-Level Security (RLS) means the database itself enforces that users can only access their own data — even if there were a bug in the app code, data couldn't leak between users.
- User language preference is saved in the user's auth metadata.

---

### Google Gemini AI (gemini-2.5-flash)
**What it is:** Google's AI model, used for extracting structured data from text.

**What it does:**
- Reads your meeting transcript and extracts: person names, their attributes (job, age, school, etc.), family members, the meeting date and location.
- Has special rules to avoid mistakes: doesn't treat family members as separate people you met, handles Korean input (stores keys in Korean), knows your existing saved people to avoid duplicates.
- Called twice per extraction: once for general meeting logging, once for adding notes to an existing person.

---

### Google Calendar API
**What it is:** Google's official API for reading calendar events.

**What it does:**
- After you grant permission, the app reads your calendar events for the next 7 days.
- Only reads — never creates, edits, or deletes anything.
- Compares event attendees and titles against your saved people to find matches.

---

### Capacitor (Apache Cordova successor)
**What it is:** A framework that wraps a web app into a native Android/iOS app.

**What it does:**
- Packages the Next.js web app into an APK (Android) or IPA (iOS) file.
- Gives access to native device features:
  - **SpeechRecognition plugin** — uses the phone's built-in speech recognition (more reliable than browser-based on mobile).
  - **Splash screen** — the loading screen when the app first opens.
  - **Status bar** — controls the color/style of the phone's status bar.
  - **Browser plugin** — opens external links (like Google OAuth) in a proper in-app browser.
- The app server URL is configured in `android/app/src/main/assets/capacitor.config.json` — must match the live deployment URL.

---

### Web Speech API
**What it is:** A browser-built-in speech recognition API.

**What it does:**
- Fallback for voice input when running in a browser (not native app).
- Works in Chrome and Edge.
- On other browsers (Firefox, Safari), voice input is unavailable and a message is shown.

---

### Vercel
**What it is:** The hosting platform the app is deployed on.

**What it does:**
- Runs the Next.js app server.
- Serves the website at `rememberone.online`.
- Handles environment variables (API keys, secrets).
- Provides server logs for debugging.

---

## How Everything Connects (User Flow)

Here is the complete journey from opening the app to every major action.

---

### 1. Opening the App & Logging In

```
Open app
    │
    ▼
Is user logged in? (Supabase session check)
    │
    ├── No → redirect to /login
    │           │
    │           ├── "Sign in with Google"
    │           │       │
    │           │       ├── Opens Google OAuth consent screen in browser/in-app browser
    │           │       ├── User approves → Google redirects to /auth/callback with a code
    │           │       ├── Supabase exchanges code for session tokens
    │           │       └── User is now logged in → redirect to home (/)
    │           │
    │           └── Email & Password
    │                   │
    │                   ├── New user: Supabase sends confirmation email
    │                   │       └── User clicks link → /auth/callback → session created → home (/)
    │                   └── Returning user: password verified → session created → home (/)
    │
    └── Yes → skip login, go directly to home (/)
```

---

### 2. First-Time Language Setup

```
Home page (/) loads
    │
    ▼
Does user have a language set in account metadata?
    │
    ├── No (brand new account) → LanguagePickerModal appears on top of the screen
    │       │
    │       ├── User taps English → language saved as "en" in Supabase user metadata
    │       └── User taps Korean → language saved as "ko" in Supabase user metadata
    │               → All UI text, dates, and AI instructions switch to Korean immediately
    │
    └── Yes → modal is skipped, app uses saved language
```

---

### 3. Home Page — Browsing & Searching People

```
Home page (/)
    │
    ▼
Fetch all people (GET /api/people — returns full nested data in 5 DB queries)
    │
    ├── Zero people saved
    │       └── Empty state shown: "You haven't saved anyone yet"
    │               └── "Log Your First Meeting" button → /meet (general mode)
    │
    └── People exist → PeopleGrid renders all person cards
            │
            ├── Each card shows:
            │       name, last-met date, key attribute chips (job, company, etc.),
            │       family member names, interest tags
            │
            ├── User types in search box
            │       └── Filters cards client-side in real time across:
            │               name, all attribute values, family member names, notes
            │
            ├── Google Calendar connected + upcoming match found
            │       └── Blue UpcomingMeetingAlert banner appears at top
            │               showing event name, date, matched person's key details
            │
            ├── Tap mic icon on a person card → /meet?personId=[id]  (→ see Flow 5)
            │
            └── Tap a person card → /people/[id]  (→ see Flow 6)
```

---

### 4. Logging a New Meeting — General Mode (`/meet`)

```
User navigates to /meet (via nav tab or "Log Your First Meeting" button)
    │
    ▼
ConversationInput renders in general mode (no person locked)
    │
    ├── Voice input (Android/iOS):
    │       Tap mic → phone native SpeechRecognition starts
    │       Speak → live transcript appears on screen
    │       Tap mic again to stop → transcript saved to text area
    │       (Can tap mic again to append more speech to the same text area)
    │
    ├── Voice input (browser — Chrome/Edge):
    │       Same flow using Web Speech API
    │       Other browsers: mic disabled, message shown
    │
    └── Or: user types directly into the text area
            │
            ▼
        Text is present → "EXTRACT & SAVE" button appears
            │
            ▼
        User taps "EXTRACT & SAVE"
            │
            ▼
        POST /api/ai/extract  { text: "..." }
            │
            ├── Auth check (must be logged in)
            ├── Validate text (3–4000 characters)
            ├── Fetch user's saved people names (for duplicate prevention)
            ├── Call Gemini AI (gemini-2.5-flash):
            │       Input:  raw transcript + today's date + language + existing names
            │       Output: { people: [...], meeting_date, location }
            │               Each person has: name, summary, attributes[], family_members[]
            │
            ├── AI returned 0 people? → return 422 error, show "No people found" message
            │
            └── saveExtractionResult() runs for each person:
                    │
                    ├── Check if person name already exists in DB (case-insensitive match)
                    │       ├── Yes → reuse existing person ID, update updated_at timestamp
                    │       └── No  → INSERT new row into `people` table → get new ID
                    │
                    ├── For each extracted attribute:
                    │       UPSERT into `person_attributes` (person_id + key = unique)
                    │       → sets or overwrites the value for that key
                    │
                    ├── For each extracted family member:
                    │       Check if family member with same name already exists
                    │       ├── Yes → reuse existing family member ID
                    │       └── No  → INSERT into `family_members` (name, relation, person_id)
                    │       Then UPSERT their attributes into `family_member_attributes`
                    │
                    └── INSERT into `meetings` table:
                            raw_input, meeting_date (resolved by AI or today), location, summary
                    │
                    ▼
            Success → return extraction result + person IDs to client
                    │
                    ▼
            UI shows result preview:
                    person name, summary, attributes saved, family members saved
                    │
                    ├── "Go to People" → home page (/)
                    └── "Log Another" → clears form, stays on /meet
```

---

### 5. Logging a Meeting — Person Mode (`/meet?personId=[id]`)

```
User arrives at /meet?personId=[id]
(via mic icon on person card, or "LOG MEETING WITH" button on profile)
    │
    ▼
Server fetches person name from DB to confirm they exist
ConversationInput renders locked to that one person
Header shows: "Logging meeting with [Name]"
    │
    ▼
User speaks or types (same input flow as general mode)
    │
    ▼
"SAVE FOR [Name]" button appears
    │
    ▼
POST /api/people/[id]/notes  { text: "..." }
    │
    ├── Auth + ownership check
    ├── Fetch full person from DB (including existing family members)
    ├── Call Gemini AI (extractAdditionalInfo):
    │       Input:  raw notes + person's name + today's date
    │               + list of already-known family members (to avoid duplicates)
    │       Output: { attributes[], family_members[], meeting_date, location, summary }
    │
    ├── UPSERT each new attribute into `person_attributes`
    │       (won't delete existing ones not mentioned)
    │
    ├── For each new family member:
    │       Check if already exists by name
    │       ├── Yes → reuse ID, upsert any new attributes for them
    │       └── No  → INSERT new family member, then upsert their attributes
    │
    ├── INSERT new row into `meetings` table
    │
    ├── UPDATE person's `updated_at` timestamp
    │
    └── Return fully updated person object to client
            │
            ▼
    UI shows updated profile inline (attributes, family, meeting log refresh)
```

---

### 6. Viewing & Editing a Person Profile (`/people/[id]`)

```
User taps a person card → navigate to /people/[id]
    │
    ▼
Server fetches full person: attributes, family members + their attributes, all meetings
    │
    ▼
Profile page renders:
    │
    ├── Header: avatar (initials), name, "Last met X days ago · N meetings"
    │       └── Tap name → inline text input appears → type new name → press Enter or click away
    │               → PUT /api/people/[id]  { name: "..." } → name updated in DB
    │
    ├── Attribute chips: job, age, school, etc.
    │
    ├── "LOG MEETING WITH [Name]" button → /meet?personId=[id]  (→ see Flow 5)
    │
    ├── "Add Notes" panel (tap to expand)
    │       └── Same voice/text input as person mode
    │               → POST /api/people/[id]/notes  (→ see Flow 5 for detail)
    │
    ├── "Edit Details" section
    │       ├── Shows all attributes as editable key-value fields
    │       ├── Edit a value → PUT /api/people/[id]/attributes  { key, value }
    │       ├── Delete an attribute → DELETE /api/people/[id]/attributes  { key }
    │       └── Add new attribute manually → POST /api/people/[id]/attributes  { key, value }
    │
    ├── "Family" section
    │       ├── Shows each family member as a card (name, relation, their attributes)
    │       ├── Tap "Add family member" → AddFamilyMemberForm
    │       │       Fill name + relation → POST /api/people/[id]/family
    │       ├── Edit family member → PATCH /api/people/[id]/family/[fmId]
    │       └── Delete family member → DELETE /api/people/[id]/family/[fmId]
    │
    ├── "Meetings (N)" section
    │       Shows timeline of all logged meetings, newest first:
    │       date · location (if any) · AI summary · original transcript (expandable)
    │
    └── "Delete [Name]" button
            → Confirmation prompt appears
            → DELETE /api/people/[id]
            → Removes person + all their attributes, family, meetings from DB
            → Redirect to home (/)
```

---

### 7. Calendar Page (`/calendar`)

```
User taps "Calendar" in nav → /calendar
    │
    ▼
Fetch all meetings across all people (grouped by date, newest first)
    │
    ├── Google Calendar connected?
    │       └── Yes → GET /api/calendar/events
    │               ├── Fetch events for next 7 days from Google
    │               ├── Auto-refresh access token if expired
    │               ├── Compare event attendees + titles against saved people names
    │               └── Matched events → show UpcomingMeetingAlert banner at top
    │
    └── Render meeting timeline:
            Each date group shows: person name, their info chips, meeting summary
```

---

### 8. Connecting Google Calendar

```
User goes to Account page → taps "Connect Google Calendar"
    │
    ▼
GET /api/calendar/connect
    → Generates Google OAuth URL (scope: read-only calendar access)
    → Redirects user to Google's permission screen
        │
        └── User approves
                │
                ▼
            GET /api/calendar/callback?code=...
                ├── Exchange code for access_token + refresh_token
                ├── Save tokens + expiry to `calendar_connections` table
                └── Redirect back to account page — calendar now connected
```

---

### 9. Changing Language

```
User goes to Account page → taps "Language"
    │
    ▼
Language selector expands showing English 🇺🇸 and Korean 🇰🇷
    │
    └── User taps a language
            │
            ├── Saves language code to Supabase user metadata
            ├── All UI text re-renders immediately in new language
            ├── Dates switch format (e.g., "March 15" ↔ "3월 15일")
            ├── Attribute keys auto-translated in display (e.g., "Job" ↔ "직업")
            └── From this point on, all new AI extractions store keys in the new language
```

---

## Language Support

The app fully supports English and Korean. Here is exactly what changes when you switch to Korean:

| Area | English example | Korean example |
|---|---|---|
| Navigation tabs | People, Log meeting, Calendar | 사람들, 만남 기록, 캘린더 |
| Mic page status | CLICK TO BECOME FRIENDLY | 탭해서 기록하기 |
| Relative dates | "3 days ago", "yesterday" | "3일 전", "어제" |
| Full dates | "March 15, 2024" | "2024년 3월 15일" |
| Attribute keys (new data) | Job, Company, Age | 직업, 회사, 나이 |
| Attribute keys (old English data) | Job → displayed as "Job" | Job → displayed as "직업" (auto-translated) |
| Section headers | Edit Details, Family, Interest | 정보 수정, 가족, 관심사 |
| Buttons | LOG MEETING WITH JAKE | 만남 기록하기 — JAKE |
| Empty states | No one here yet | 아직 아무도 없어요 |
| Account page | Sign out, Language, Delete Account | 로그아웃, 언어, 계정 삭제 |
| Privacy Policy | Full English text | Full Korean text |
| Child Safety | Full English text | Full Korean text |
| AI summaries | "Jake is a software engineer at Google" | "제이크는 구글의 소프트웨어 엔지니어입니다" |
| Speech recognition locale | en-US | ko-KR |

The language is stored in your account so it's remembered across all devices and sessions.

---

*Last updated: March 2026*
