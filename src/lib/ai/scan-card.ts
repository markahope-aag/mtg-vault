/**
 * Single-card vision scanner.
 *
 * Takes a base64-encoded photo of a Magic card and asks Claude to identify
 * the printed name and (if visible) the set / collector number. Returns
 * structured data via Anthropic tool-use so the caller can look up the
 * matching printing in our DB.
 *
 * Notes:
 * - We use Haiku for cost: identification from a clear photo is well within
 *   Haiku's capability and we don't want to pay Opus rates for every snap.
 * - Output is restricted via tool-use so we never have to parse free text.
 */
import Anthropic from "@anthropic-ai/sdk";

export const SCAN_MODEL = "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 512;

export type ScanResult = {
  name: string | null;
  // Three-letter set code if it's clearly visible on the card (bottom-left
  // expansion symbol's accompanying text), otherwise null. Helps us
  // disambiguate when a card has many printings.
  setCode: string | null;
  collectorNumber: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

const SCAN_TOOL: Anthropic.Tool = {
  name: "submit_card_identification",
  description:
    "Submit the identified Magic: The Gathering card from the user's photo.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: ["string", "null"],
        description:
          "The card's printed name exactly as it appears on the card. Null if the card name is not legible.",
      },
      setCode: {
        type: ["string", "null"],
        description:
          "Three-letter (or four-letter for newer sets) set code if visible in the bottom-left text on the card. Null if not visible. Lowercase.",
      },
      collectorNumber: {
        type: ["string", "null"],
        description:
          "Collector number (e.g. '042' or '042a') from the bottom-left of the card. Null if not visible.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "How confident you are in the identification. 'high' = card name fully readable; 'medium' = readable but partially obscured; 'low' = guessing from art.",
      },
      notes: {
        type: ["string", "null"],
        description:
          "Any caveats about the identification (multiple cards visible, glare, language other than English, etc.). Null if no notes.",
      },
    },
    required: ["name", "setCode", "collectorNumber", "confidence", "notes"],
  },
};

const SYSTEM_PROMPT = `You identify Magic: The Gathering cards from photographs. Look at the
image and return the card's printed name, set code, and collector number
via the submit_card_identification tool. If multiple cards are visible,
identify the most prominent / largest one. If the photo is too blurry,
poorly lit, or obscured to read the name with reasonable confidence,
return null for name and set confidence to "low". Do not guess from the
art alone unless you're certain.`.trim();

export async function scanCard(imageBase64: string, mediaType: string): Promise<ScanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable the scanner.",
    );
  }
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: SCAN_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [SCAN_TOOL],
    tool_choice: { type: "tool", name: "submit_card_identification" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              // Anthropic SDK accepts these media types; "image/jpeg" /
              // "image/png" / "image/webp" / "image/gif".
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Identify this Magic: The Gathering card.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `Model did not call submit_card_identification (stop_reason: ${response.stop_reason})`,
    );
  }
  return toolUse.input as ScanResult;
}
