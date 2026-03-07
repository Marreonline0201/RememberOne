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

const EXTRACTION_SYSTEM_PROMPT = `You are a personal memory assistant. Your job is to extract structured information about people from a user's natural language description of who they met.

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

Rules:
- Extract EVERY person mentioned as a primary contact (people the user directly met).
- Attribute keys must be human-readable labels in Title Case: "Job Title", "Company", "University", "Hobby", "City", "Age", "Phone", "Email", "LinkedIn", etc.
- Attribute values must be concise strings.
- Family member relations must be lowercase singular nouns: "son", "daughter", "spouse", "partner", "mother", "father", "brother", "sister", "cousin", "friend".
- If the user mentions a date (e.g. "today", "yesterday", "last Tuesday"), resolve it relative to today's date and output as YYYY-MM-DD. If no date is mentioned output null.
- If you cannot determine a value with confidence, omit that attribute rather than guessing.
- If no people are mentioned, return { "people": [], "meeting_date": null, "location": null }.`;

export async function extractPeopleFromText(
  userInput: string,
  todayDate: string
): Promise<AIExtractionResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: EXTRACTION_SYSTEM_PROMPT,
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
  existingFamilyMembers: KnownFamilyMember[] = []
): Promise<AdditionalExtractionResult> {
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
- "attributes" are facts about ${personName} themselves: job, company, hobby, city, age, phone, email, etc. Keys in Title Case.
- CRITICAL — existing family members: If the notes mention an existing family member by name (listed above), add new facts about them as attributes under that family member. Do NOT create a new family member entry for them. Example: if "Bunny (daughter)" already exists and the note says "Bunny is in James Kindergarden", output Bunny in family_members with attribute { "key": "Kindergarten", "value": "James Kindergarden" } — NOT a new family member named James.
- CRITICAL — names in place/school names: A name that appears as part of a school, institution, or place (e.g. "James Kindergarden", "St. Mary's School", "Lincoln Elementary") is NOT a person. Do not add it to family_members.
- Only add NEW entries to "family_members" if the person is explicitly stated to be a relative of ${personName} (son, daughter, spouse, partner, sibling, parent, etc.) AND they are not already in the existing list above.
- "meeting_date": ISO "YYYY-MM-DD" if a date is mentioned, otherwise null.
- "location": where the meeting/interaction happened, or null.
- "summary": one concise sentence describing what new information was learned.
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
