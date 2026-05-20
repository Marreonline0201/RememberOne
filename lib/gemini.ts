// Gemini API client and extraction logic
// Uses @google/generative-ai with gemini-2.5-flash

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIExtractionResult, ExtractedAttribute, ExtractedFamilyMember } from "@/types/app";

export interface AdditionalExtractionResult {
  attributes: ExtractedAttribute[];
  family_members: ExtractedFamilyMember[];
  meeting_date: string | null;
  location: string | null;
  summary: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function buildExtractionPrompt(language: "en" | "ko", existingPeopleNames: string[]): string {
  const isKorean = language === "ko";

  const keyLanguageRule = isKorean
    ? `- Attribute keys must be human-readable labels IN KOREAN: "직업", "회사", "대학교", "학교", "학년", "취미", "도시", "나이", "전화번호", "이메일", "링크드인" etc. Use "학년" for school grade/year (e.g. "중학교 2학년", "초등학교 6학년").`
    : `- Attribute keys must be human-readable labels in English Title Case: "Job Title", "Company", "University", "Hobby", "City", "Age", "Phone", "Email", "LinkedIn", etc.`;

  const summaryLanguageRule = isKorean
    ? `- "summary" must be written in Korean.`
    : `- "summary" must be written in English.`;

  const unnamedMemberRule = isKorean
    ? `- CRITICAL — unnamed family members: 이름을 모르는 가족은 관계명을 한국어 플레이스홀더로 사용하세요. 한 명이면 관계명만 (예: "아들", "딸"). 같은 관계가 여러 명이면 번호를 붙이세요 (예: "아들 1", "아들 2", "딸 1", "딸 2"). 절대 개수를 attribute로 저장하지 마세요 (예: { "key": "아들 수", "value": "2" } 금지). 예시: "아들이 두 명" → [{ "name": "아들 1", "relation": "son", "attributes": [] }, { "name": "아들 2", "relation": "son", "attributes": [] }].`
    : `- CRITICAL — unnamed family members: If a family member is mentioned but has no name, still add them to "family_members" with a placeholder name. For a single unnamed member use the relation capitalized (e.g. "Son", "Daughter"). For multiple unnamed members of the same relation, number them (e.g. "Son 1", "Son 2", "Son 3"). NEVER store the count as an attribute (e.g. do NOT output { "key": "Daughters", "value": "3" }). Example: "Mike has 3 daughters" → family_members: [{ "name": "Daughter 1", "relation": "daughter", "attributes": [] }, { "name": "Daughter 2", "relation": "daughter", "attributes": [] }, { "name": "Daughter 3", "relation": "daughter", "attributes": [] }].`;

  const educationRule = isKorean
    ? `- KOREAN EDUCATION: 초등학교 6년 (1~6학년), 중학교 3년 (1~3학년), 고등학교 3년 (1~3학년). 학년 언급 시 key "학년", value에 전체 표현 저장 (예: "중학교 2학년", "초등학교 6학년").`
    : "";

  const existingPeopleSection =
    existingPeopleNames.length > 0
      ? `\nKNOWN PEOPLE (already saved — use the EXACT name from this list if the user is referring to one of them):
${existingPeopleNames.map((n) => `- ${n}`).join("\n")}`
      : "";

  return `You are a personal memory assistant. Your job is to extract structured information about people from a user's natural language description of who they met.

You must respond with ONLY valid JSON — no markdown fences, no explanation, no extra text. The JSON must exactly match this TypeScript type:

{
  "people": [
    {
      "name": string,                         // Full name or first name if last name unknown
      "summary": string,                      // One sentence summary of who this person is
      "attributes": [
        { "key": string, "value": string }    // Any facts about the person: job, company, university, hobby, city, age, etc.
      ],
      "family_members": [
        {
          "name": string,
          "relation": string,                 // son, daughter, spouse, partner, brother, sister, mother, father, etc.
          "attributes": [
            { "key": string, "value": string }
          ]
        }
      ]
    }
  ],
  "meeting_date": string | null,             // ISO date "YYYY-MM-DD" if mentioned, otherwise null
  "location": string | null                  // Where the meeting happened, or null
}
${existingPeopleSection}

Rules:
- CRITICAL — primary contacts only: Only add a person to the "people" array if the user explicitly says they met that person directly. People mentioned only as someone else's family member (e.g. "his son", "her mother", "their boss") must NOT appear in "people" — they belong only in the "family_members" array of the person who was directly met.
- CRITICAL — same person across sentences: The user may speak in multiple short bursts. Treat all sentences as one continuous description. If sentences after the first refer to the same person using pronouns or omit the subject (especially in Korean), they all describe the most recently named person.
- CRITICAL — name matching: If a person's name closely matches a name in the KNOWN PEOPLE list (same person, different romanization, or partial name), use the EXACT name from the known list.
- CRITICAL — STABLE FACTS ONLY in "attributes": An attribute represents a STABLE characteristic of the person that doesn't change frequently and isn't tied to a specific date. Allowed attribute kinds: Job Title, Company, School, University, Major, Grade, City, Age, Phone, Email, LinkedIn, Hobby, Sport, Language, Religion. Their Korean equivalents are also allowed.
- NEVER create an attribute for any of these — they must go in "summary" instead, as natural prose:
  * Dated events or plans: "traveling June 1st", "wedding next month", "moving in summer", "interview tomorrow"
  * Historical changes: "used to live in NY", "moved from LA to Seattle", "was an engineer before becoming a PM"
  * Recent happenings: "got promoted last week", "had a baby", "just got married", "recently visited Japan"
  * Emotional / momentary state: "seemed stressed", "was excited about work", "in a great mood today"
  * Plans / intentions: "thinking about grad school", "plans to start a business"
- "summary" must be a one-sentence natural-language recap mentioning the person's role plus any events, changes, plans, or context worth remembering. Examples:
  * "John is a software engineer at Google who is traveling to Tokyo on June 1st."
  * "Sarah moved from NY to LA last year and just got promoted to Senior Engineer."
  * "Mike works at a startup and seemed stressed about an upcoming product launch."
${keyLanguageRule}
${summaryLanguageRule}
- Attribute values must be concise strings.
- Family member relations must be lowercase singular nouns: "son", "daughter", "spouse", "partner", "mother", "father", "brother", "sister", "cousin", "friend".
${unnamedMemberRule}
${educationRule}
- If the user mentions a date (e.g. "today", "yesterday", "last Tuesday", "오늘", "어제"), resolve it relative to today's date and output as YYYY-MM-DD. If no date is mentioned output null.
- If you cannot determine a value with confidence, omit that attribute rather than guessing.
- If no people are mentioned, return { "people": [], "meeting_date": null, "location": null }.`;
}

export async function extractPeopleFromText(
  userInput: string,
  todayDate: string,
  language: "en" | "ko" = "en",
  existingPeopleNames: string[] = []
): Promise<AIExtractionResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: buildExtractionPrompt(language, existingPeopleNames),
  });

  const userMessage = `Today's date is ${todayDate}.

The user said:
"""
${userInput}
"""

Extract all people and structured information as described. Respond with only the JSON object.`;

  let raw: string;
  try {
    const result = await model.generateContent(userMessage);
    raw = result.response
      .text()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error("[Gemini fetch error]", fetchErr);
    if (msg.includes("API key")) {
      throw new Error("Invalid Gemini API key. Check GEMINI_API_KEY in your .env.local file.");
    }
    if (msg.includes("404") || msg.includes("not found")) {
      throw new Error("Gemini model not found. The model name may have changed.");
    }
    if (msg.includes("429") || msg.includes("quota")) {
      throw new Error("Gemini API rate limit reached. Please wait a moment and try again.");
    }
    throw new Error(`Gemini API error: ${msg}`);
  }

  let parsed: AIExtractionResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Gemini returned non-JSON:", raw);
    throw new Error("Gemini did not return valid JSON");
  }

  if (!Array.isArray(parsed.people)) {
    throw new Error("Gemini JSON missing 'people' array");
  }

  return parsed;
}

// ============================================================
// Extract additional info about a specific known person
// ============================================================

export interface KnownFamilyMember {
  name: string;
  relation: string;
}

export async function extractAdditionalInfo(
  userInput: string,
  personName: string,
  todayDate: string,
  existingFamilyMembers: KnownFamilyMember[] = [],
  language: "en" | "ko" = "en"
): Promise<AdditionalExtractionResult> {
  const isKorean = language === "ko";
  const keyLanguageRule = isKorean
    ? `- "attributes" keys must be in Korean: "직업", "회사", "취미", "도시", "나이", "학교", "학년", "대학교" etc. Use "학년" for school grade/year (e.g. "중학교 2학년", "초등학교 6학년").`
    : `- "attributes" keys must be in English Title Case: "Job Title", "Company", "Hobby", "City", "Age", etc.`;
  const summaryRule = isKorean
    ? `- "summary" must be written in Korean.`
    : `- "summary" must be written in English.`;
  const unnamedMemberRule = isKorean
    ? `- CRITICAL — unnamed family members: 이름을 모르는 가족은 관계명을 한국어 플레이스홀더로 사용하세요. 한 명이면 관계명만 (예: "아들", "딸"). 같은 관계가 여러 명이면 번호를 붙이세요 (예: "아들 1", "아들 2", "딸 1", "딸 2"). 절대 개수를 attribute로 저장하지 마세요. 예시: "아들이 두 명" → [{ "name": "아들 1", "relation": "son", "attributes": [] }, { "name": "아들 2", "relation": "son", "attributes": [] }].`
    : `- CRITICAL — unnamed family members: If a family member is mentioned but has no name, still add them to "family_members" with a placeholder name. For a single unnamed member use the relation capitalized (e.g. "Son", "Daughter"). For multiple unnamed members of the same relation, number them (e.g. "Son 1", "Son 2", "Son 3"). NEVER store the count as an attribute (e.g. do NOT output { "key": "Daughters", "value": "3" }). Example: "Mike has 3 daughters" → family_members: [{ "name": "Daughter 1", "relation": "daughter", "attributes": [] }, { "name": "Daughter 2", "relation": "daughter", "attributes": [] }, { "name": "Daughter 3", "relation": "daughter", "attributes": [] }].`;
  const educationRule = isKorean
    ? `- KOREAN EDUCATION: 초등학교 6년 (1~6학년), 중학교 3년 (1~3학년), 고등학교 3년 (1~3학년). 학년 언급 시 key "학년", value에 전체 표현 저장 (예: "중학교 2학년", "초등학교 6학년").`
    : "";

  const familyContext =
    existingFamilyMembers.length > 0
      ? `EXISTING FAMILY MEMBERS OF ${personName} (already saved):\n${existingFamilyMembers
          .map((fm) => `- ${fm.name} (${fm.relation})`)
          .join("\n")}`
      : `${personName} has no family members saved yet.`;

  const prompt = `You are a personal memory assistant. The user is adding more notes about a specific person they already know. Extract any new details about that person from the notes.

You must respond with ONLY valid JSON — no markdown fences, no explanation. Match this exact shape:

{
  "attributes": [
    { "key": string, "value": string }
  ],
  "family_members": [
    {
      "name": string,
      "relation": string,
      "attributes": [{ "key": string, "value": string }]
    }
  ],
  "meeting_date": string | null,
  "location": string | null,
  "summary": string
}

${familyContext}

Rules:
${keyLanguageRule}
${summaryRule}
- CRITICAL — STABLE FACTS ONLY in "attributes": An attribute represents a STABLE characteristic of the person that doesn't change frequently and isn't tied to a specific date. Allowed attribute kinds: Job Title, Company, School, University, Major, Grade, City, Age, Phone, Email, LinkedIn, Hobby, Sport, Language, Religion. Their Korean equivalents are also allowed.
- NEVER create an attribute for any of these — they must go in "summary" instead, as natural prose:
  * Dated events or plans: "traveling June 1st", "wedding next month", "moving in summer", "interview tomorrow"
  * Historical changes: "used to live in NY", "moved from LA to Seattle", "was an engineer before becoming a PM"
  * Recent happenings: "got promoted last week", "had a baby", "just got married", "recently visited Japan"
  * Emotional / momentary state: "seemed stressed", "was excited about work", "in a great mood today"
  * Plans / intentions: "thinking about grad school", "plans to start a business"
- "summary" must be a one-sentence natural-language recap mentioning ${personName}'s situation and any events, changes, plans, or context worth remembering. Examples:
  * "${personName} just got promoted to Senior Engineer and is traveling to Tokyo on June 1st."
  * "${personName} moved from NY to LA last year and seemed excited about the new job."
- CRITICAL — existing family members: If the notes mention an existing family member by name (listed above), add new facts about them as attributes under that family member. Do NOT create a new family member entry for them. Example: if "Bunny (daughter)" already exists and the note says "Bunny is in James Kindergarden", output Bunny in family_members with attribute { "key": "Kindergarten", "value": "James Kindergarden" } — NOT a new family member named James.
- CRITICAL — names in place/school names: A name that appears as part of a school, institution, or place (e.g. "James Kindergarden", "St. Mary's School", "Lincoln Elementary") is NOT a person. Do not add it to family_members.
- Only add NEW entries to "family_members" if the person is explicitly stated to be a relative of ${personName} (son, daughter, spouse, partner, sibling, parent, etc.) AND they are not already in the existing list above.
${unnamedMemberRule}
${educationRule}
- "meeting_date": ISO "YYYY-MM-DD" if a date is mentioned (including Korean date words like "오늘", "어제"), otherwise null.
- "location": where the meeting/interaction happened, or null.
- If no new info is found, return empty arrays and a summary saying so.`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: prompt,
  });

  const userMessage = `Today's date is ${todayDate}.
The person these notes are about: ${personName}

The user said:
"""
${userInput}
"""

Extract new details about ${personName}. Respond with only the JSON object.`;

  let raw: string;
  try {
    const result = await model.generateContent(userMessage);
    raw = result.response
      .text()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error("[Gemini fetch error - additional info]", fetchErr);
    if (msg.includes("API key")) throw new Error("Invalid Gemini API key. Check GEMINI_API_KEY in your .env.local file.");
    if (msg.includes("404") || msg.includes("not found")) throw new Error("Gemini model not found. The model name may have changed.");
    if (msg.includes("429") || msg.includes("quota")) throw new Error("Gemini API rate limit reached. Please wait a moment and try again.");
    throw new Error(`Gemini API error: ${msg}`);
  }

  let parsed: AdditionalExtractionResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Gemini returned non-JSON:", raw);
    throw new Error("Gemini did not return valid JSON");
  }

  if (!Array.isArray(parsed.attributes)) parsed.attributes = [];
  if (!Array.isArray(parsed.family_members)) parsed.family_members = [];
  if (!parsed.summary) parsed.summary = "Additional notes added.";

  return parsed;
}

// ── Audio transcription ───────────────────────────────────────────────────
// Used by /api/ai/transcribe. Gemini 2.5 Flash accepts audio inputs natively
// via inlineData parts. Returns just the raw verbatim transcript text.
//
// We normalize the WebM container that Chrome/Android record into ("audio/webm")
// to the MIME Gemini documents support. mp4 → aac, ogg/webm stay as-is.
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  language: "en" | "ko",
  polish: boolean = false
): Promise<string> {
  const lower = mimeType.toLowerCase();
  const normalizedMime = lower.startsWith("audio/mp4")
    ? "audio/aac"
    : lower.startsWith("audio/webm")
      ? "audio/webm"
      : lower.startsWith("audio/ogg")
        ? "audio/ogg"
        : lower.startsWith("audio/wav") || lower.startsWith("audio/x-wav")
          ? "audio/wav"
          : lower.startsWith("audio/mp3") || lower.startsWith("audio/mpeg")
            ? "audio/mp3"
            : mimeType;

  // Two prompt modes:
  //  - verbatim: word-for-word, used by the /meet conversation flow which
  //    then feeds the AI extractor (it wants the raw voice).
  //  - polish: write exactly what the speaker said BUT with corrected
  //    grammar, punctuation, and obvious typos. Same facts, cleaner prose.
  //    Used by the Notes voice button on the person detail page.
  const prompt = polish
    ? language === "ko"
      ? "이 오디오의 화자가 말한 내용을 한국어로 받아쓰되, 문법·구두점·맞춤법만 자연스럽게 다듬으세요. 새로운 정보를 추가하지 말고 사실을 바꾸지 마세요. 부연 설명, 마크다운, 따옴표 없이 다듬어진 트랜스크립트 텍스트만 반환하세요. 화자 표시도 붙이지 마세요."
      : "Write down exactly what the speaker said in this audio, but with corrected grammar, punctuation, and obvious typos. Keep every detail and fact the same — do not add new information, do not remove information, do not paraphrase. Return only the cleaned-up transcript text — no explanations, no markdown, no quotes, no speaker labels."
    : language === "ko"
      ? "이 오디오를 한국어로 그대로 받아쓰세요. 부연 설명, 마크다운, 따옴표 없이 트랜스크립트 텍스트만 반환하세요. 화자 표시도 붙이지 마세요."
      : "Transcribe this audio verbatim. Return only the transcript text — no explanations, no markdown, no quotes, no speaker labels.";

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.0,
      responseMimeType: "text/plain",
    },
  });

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: audioBase64,
        mimeType: normalizedMime,
      },
    },
  ]);

  const text = result.response.text().trim();
  return text.slice(0, 4000);
}

