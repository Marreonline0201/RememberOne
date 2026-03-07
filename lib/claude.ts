// Claude API client and extraction logic
// Uses @anthropic-ai/sdk with claude-sonnet-4-6

import Anthropic from "@anthropic-ai/sdk";
import type { AIExtractionResult } from "@/types/app";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ============================================================
// System prompt — instructs Claude to extract structured info
// ============================================================
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

// ============================================================
// Main extraction function
// ============================================================
export async function extractPeopleFromText(
  userInput: string,
  todayDate: string   // pass in as "YYYY-MM-DD" from the server so Claude can resolve relative dates
): Promise<AIExtractionResult> {
  const userMessage = `Today's date is ${todayDate}.

The user said:
"""
${userInput}
"""

Extract all people and structured information as described. Respond with only the JSON object.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  // The response content should be a single text block containing JSON
  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  let parsed: AIExtractionResult;
  try {
    // Strip any accidental markdown fences just in case
    const raw = content.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Claude returned non-JSON:", content.text);
    throw new Error("Claude did not return valid JSON");
  }

  // Validate minimal shape
  if (!Array.isArray(parsed.people)) {
    throw new Error("Claude JSON missing 'people' array");
  }

  return parsed;
}
