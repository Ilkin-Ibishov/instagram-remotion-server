import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { NewsArticle, GeneratedContent } from "./types";
import type { AccountProfile } from "./accountProfile";
import { config as brandConfig } from "./config";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Logger } from "../utils/logger";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

// Use explicit type to avoid readonly vs mutable conflicts in Gemini SDK
const schema: any = {
  description: "Instagram Carousel Post Content",
  type: SchemaType.OBJECT,
  properties: {
    manifest: {
      type: SchemaType.OBJECT,
      properties: {
        format: { type: SchemaType.STRING },
        globalBranding: {
          type: SchemaType.OBJECT,
          properties: {
            accentColor: { type: SchemaType.STRING },
            handle: { type: SchemaType.STRING },
            effects: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ["accentColor", "handle", "effects"],
        },
        carousel: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              templateId: { type: SchemaType.STRING },
              data: { type: SchemaType.OBJECT },
            },
            required: ["templateId", "data"],
          },
        },
      },
      required: ["format", "globalBranding", "carousel"],
    },
    caption: { type: SchemaType.STRING },
    hashtags: { type: SchemaType.STRING },
  },
  required: ["manifest", "caption", "hashtags"],
};

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    // Schema removed: Gemini was creating empty data objects to satisfy the schema.
    // The detailed prompt provides enough instruction. If schema issues persist,
    // we can re-enable with proper field definitions per slide type.
  },
});

const DEFAULT_MIN_SLIDES = 3;
const DEFAULT_MAX_SLIDES = 5;
const DEFAULT_GEMINI_TIMEOUT_MS = 60000;

const TEMPLATE_PLANS = [
  ["HOOK_A", "CONTENT_LISTICLE", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_GENERIC", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_VIDEO", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_LISTICLE", "CONTENT_GENERIC", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_GENERIC", "CONTENT_LISTICLE", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_VIDEO", "CONTENT_GENERIC", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_LISTICLE", "CONTENT_VIDEO", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_LISTICLE", "CONTENT_GENERIC", "CONTENT_LISTICLE", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_GENERIC", "CONTENT_LISTICLE", "CONTENT_GENERIC", "CTA_FINAL"],
  ["HOOK_A", "CONTENT_VIDEO", "CONTENT_GENERIC", "CONTENT_LISTICLE", "CTA_FINAL"],
] as const;

type TemplatePlan = (typeof TEMPLATE_PLANS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function sanitizeForPrompt(value: string | undefined | null, maxLength = 500): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/`/g, "'")
    .replace(/\\/g, "\\\\")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseSlideBoundEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function resolveGeminiTimeoutMs(raw: string | undefined = process.env.GEMINI_TIMEOUT_MS): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GEMINI_TIMEOUT_MS;
  }

  return Math.max(1, Math.floor(parsed));
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function resolveSlideBoundsFromEnv(): { minSlides: number; maxSlides: number } {
  let minSlides = parseSlideBoundEnv(process.env.MIN_SLIDES, DEFAULT_MIN_SLIDES);
  let maxSlides = parseSlideBoundEnv(process.env.MAX_SLIDES, DEFAULT_MAX_SLIDES);

  minSlides = Math.max(3, Math.min(5, minSlides));
  maxSlides = Math.max(3, Math.min(5, maxSlides));

  if (minSlides > maxSlides) {
    [minSlides, maxSlides] = [maxSlides, minSlides];
  }

  return { minSlides, maxSlides };
}

export function buildRequiredTemplateSequence(
  minSlides: number,
  maxSlides: number,
  randomFn: () => number = Math.random
): TemplatePlan {
  const candidates = TEMPLATE_PLANS.filter((plan) => plan.length >= minSlides && plan.length <= maxSlides);
  const pool = candidates.length > 0 ? candidates : TEMPLATE_PLANS;
  const index = Math.floor(randomFn() * pool.length);
  return pool[Math.max(0, Math.min(pool.length - 1, index))];
}

function createSlideTemplateSpec(templateId: string, article: NewsArticle): Record<string, unknown> {
  if (templateId === "HOOK_A") {
    return {
      headline: "...",
      subheadline: "...",
      imageUrl: article.imageUrl ?? null,
    };
  }

  if (templateId === "CONTENT_LISTICLE") {
    return {
      title: "...",
      items: ["...", "...", "...", "..."],
      footnote: `Source: ${article.source}`,
    };
  }

  if (templateId === "CONTENT_GENERIC") {
    return {
      title: "...",
      body: "...",
      highlight: "...",
    };
  }

  if (templateId === "CONTENT_VIDEO") {
    return {
      title: "...",
      caption: "...",
      videoUrl: null,
      imageUrl: article.imageUrl ?? null,
      source: `Source: ${article.source}`,
    };
  }

  return {
    callToAction: "...",
    subtext: "Reply in comments",
  };
}

function buildPromptOutputExample(sequence: readonly string[], article: NewsArticle): string {
  const carousel = sequence.map((templateId) => ({
    templateId,
    data: createSlideTemplateSpec(templateId, article),
  }));

  return JSON.stringify(
    {
      manifest: {
        format: "instagram_carousel",
        globalBranding: {
          accentColor: brandConfig.brandAccentColor,
          handle: brandConfig.brandHandle,
          effects: brandConfig.brandEffects,
        },
        carousel,
      },
      caption: "...",
      hashtags: "...",
    },
    null,
    2
  );
}

export function ensureParentDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function validateSlideData(templateId: string, data: unknown, index: number): string[] {
  const errors: string[] = [];

  if (!isRecord(data)) {
    return [`slide[${index}].data must be an object`];
  }

  if (templateId === "HOOK_A") {
    if (!isNonEmptyString(data.headline)) {
      errors.push(`slide[${index}].data.headline must be a non-empty string`);
    }
    if (!isNonEmptyString(data.subheadline)) {
      errors.push(`slide[${index}].data.subheadline must be a non-empty string`);
    }
    const imageUrl = data.imageUrl;
    if (imageUrl !== null && imageUrl !== undefined && typeof imageUrl !== "string") {
      errors.push(`slide[${index}].data.imageUrl must be string, null, or undefined`);
    }
  }

  if (templateId === "CONTENT_LISTICLE") {
    if (!isNonEmptyString(data.title)) {
      errors.push(`slide[${index}].data.title must be a non-empty string`);
    }
    if (!Array.isArray(data.items) || data.items.length !== 4 || data.items.some((item) => !isNonEmptyString(item))) {
      errors.push(`slide[${index}].data.items must be an array of exactly 4 non-empty strings`);
    }
    if (!isNonEmptyString(data.footnote)) {
      errors.push(`slide[${index}].data.footnote must be a non-empty string`);
    }
  }

  if (templateId === "CONTENT_GENERIC") {
    if (!isNonEmptyString(data.title)) {
      errors.push(`slide[${index}].data.title must be a non-empty string`);
    }
    if (!isNonEmptyString(data.body)) {
      errors.push(`slide[${index}].data.body must be a non-empty string`);
    }
    if (!isNonEmptyString(data.highlight)) {
      errors.push(`slide[${index}].data.highlight must be a non-empty string`);
    }
  }

  if (templateId === "CONTENT_VIDEO") {
    if (!isNonEmptyString(data.title)) {
      errors.push(`slide[${index}].data.title must be a non-empty string`);
    }
    if (data.videoUrl !== null && data.videoUrl !== undefined && typeof data.videoUrl !== "string") {
      errors.push(`slide[${index}].data.videoUrl must be string, null, or undefined`);
    }
    if (data.imageUrl !== null && data.imageUrl !== undefined && typeof data.imageUrl !== "string") {
      errors.push(`slide[${index}].data.imageUrl must be string, null, or undefined`);
    }
    if (data.caption !== undefined && data.caption !== null && !isNonEmptyString(data.caption)) {
      errors.push(`slide[${index}].data.caption must be a non-empty string when provided`);
    }
    if (data.source !== undefined && data.source !== null && !isNonEmptyString(data.source)) {
      errors.push(`slide[${index}].data.source must be a non-empty string when provided`);
    }
  }

  if (templateId === "CTA_FINAL") {
    if (!isNonEmptyString(data.callToAction)) {
      errors.push(`slide[${index}].data.callToAction must be a non-empty string`);
    }
    if (!isNonEmptyString(data.subtext)) {
      errors.push(`slide[${index}].data.subtext must be a non-empty string`);
    }
  }

  return errors;
}

function validateGeneratedContent(payload: unknown, requiredTemplateSequence: readonly string[]): GeneratedContent {
  if (!isRecord(payload)) {
    throw new Error("Gemini response root must be an object");
  }

  const { manifest, caption, hashtags } = payload;
  if (!isRecord(manifest)) {
    throw new Error("Gemini response missing manifest object");
  }

  if (!isRecord(manifest.globalBranding)) {
    throw new Error("manifest.globalBranding must be an object");
  }

  if (!isNonEmptyString(manifest.globalBranding.accentColor)) {
    throw new Error("manifest.globalBranding.accentColor must be a non-empty string");
  }

  if (!isNonEmptyString(manifest.globalBranding.handle)) {
    throw new Error("manifest.globalBranding.handle must be a non-empty string");
  }

  if (!Array.isArray(manifest.globalBranding.effects) || manifest.globalBranding.effects.some((effect) => !isNonEmptyString(effect))) {
    throw new Error("manifest.globalBranding.effects must be an array of non-empty strings");
  }

  if (!Array.isArray(manifest.carousel)) {
    throw new Error("manifest.carousel must be an array");
  }

  if (manifest.carousel.length !== requiredTemplateSequence.length) {
    throw new Error(`manifest.carousel must contain exactly ${requiredTemplateSequence.length} slides`);
  }

  const validationErrors: string[] = [];
  for (let i = 0; i < requiredTemplateSequence.length; i += 1) {
    const expectedTemplateId = requiredTemplateSequence[i];
    const slide = manifest.carousel[i];

    if (!isRecord(slide)) {
      validationErrors.push(`slide[${i}] must be an object`);
      continue;
    }

    if (slide.templateId !== expectedTemplateId) {
      validationErrors.push(
        `slide[${i}].templateId must be ${expectedTemplateId} (received: ${String(slide.templateId)})`
      );
      continue;
    }

    validationErrors.push(...validateSlideData(expectedTemplateId, slide.data, i));
  }

  if (!isNonEmptyString(caption)) {
    validationErrors.push("caption must be a non-empty string");
  }

  if (!isNonEmptyString(hashtags)) {
    validationErrors.push("hashtags must be a non-empty string");
  }

  if (validationErrors.length > 0) {
    throw new Error(`Gemini response validation failed: ${validationErrors.join("; ")}`);
  }

  return {
    manifest: {
      format: typeof manifest.format === "string" ? manifest.format : "instagram_carousel",
      globalBranding: {
        accentColor: manifest.globalBranding.accentColor as string,
        handle: manifest.globalBranding.handle as string,
        effects: manifest.globalBranding.effects as string[],
      },
      carousel: manifest.carousel as GeneratedContent["manifest"]["carousel"],
    },
    caption: caption as string,
    hashtags: hashtags as string,
  };
}

export async function generatePostContentAI(
  article: NewsArticle,
  accountProfile?: AccountProfile
): Promise<GeneratedContent> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY not found in environment variables. Please add it to .env");
  }

  const account = accountProfile || brandConfig.accountProfile;
  const { minSlides, maxSlides } = resolveSlideBoundsFromEnv();
  const geminiTimeoutMs = resolveGeminiTimeoutMs();
  const requiredTemplateSequence = buildRequiredTemplateSequence(minSlides, maxSlides);
  const outputExample = buildPromptOutputExample(requiredTemplateSequence, article);
  const sanitizedHandle = sanitizeForPrompt(account.handle, 50);
  const sanitizedDisplayName = sanitizeForPrompt(account.displayName, 100);
  const sanitizedBio = sanitizeForPrompt(account.bio, 300);
  const sanitizedNiche = sanitizeForPrompt(account.niche.join(", "), 200);

  // Build relevance instruction if account context is available
  const relevanceCheck = account
    ? `\nRELEVANCE NOTE: This content is for ${sanitizedHandle} (${sanitizedDisplayName}).
Account focus: ${sanitizedBio}.
Account niche: ${sanitizedNiche}.
Ensure the content aligns with this audience and tone.`
    : '';

  const prompt = `You are NOT a news summarizer.

You are a high-performing Instagram content strategist whose goal is:
→ MAXIMIZE attention, retention, and engagement
→ WITHOUT distorting facts

---

## CORE PRINCIPLES (STRICT)

- DO NOT sound like AI
- DO NOT be formal or corporate
- DO NOT summarize like a blog
- PRIORITIZE curiosity, tension, and emotion
- WRITE like a human creator
- Be slightly provocative when appropriate
- Avoid safe, neutral, or corporate phrasing
- Prefer bold and opinionated wording over generic summaries
- If output feels boring, rewrite it to be more engaging
- Do NOT default to explaining - prioritize impact

BUT ALSO:

- DO NOT invent facts, quotes, numbers, or entities
- DO NOT exaggerate beyond the given article
- If information is missing -> stay general, do NOT guess
- Use tension, NOT misinformation

---

## CONTENT STRATEGY

## HOOK PATTERNS (MANDATORY)

Use ONE of these styles:

1. CONTRAST
- "X is dying. But Y is rising."
- "Nobody wants this job anymore."

2. QUESTION
- "Would you do this job today?"
- "Why is this industry collapsing?"

3. SHOCK STATEMENT
- "This skill is disappearing fast."
- "An entire profession is quietly dying."

4. RELATABLE
- "You probably never thought about this job..."
- "This affects more industries than you think"

Rules:
- MUST pick one pattern
- DO NOT generate weak generic headlines
- DO NOT invent new vague styles

### SLIDE 1 - HOOK (SCROLL STOPPER)
- Short, punchy, curiosity-driven
- Must be grounded in actual article
- No generic titles
- Must follow one of the HOOK PATTERNS above
- If headline feels generic -> rewrite using a pattern

---

### SLIDE 2 - TENSION
## SLIDE 2 STRUCTURE

Lines MUST follow:

1. Situation
2. Problem
3. Escalation
4. Consequence

Rules:
- Each line must add new tension
- Avoid repetition
- Avoid generic phrasing
- Max 4 lines, <= 10 words each

---

### SLIDE 3 - PAYOFF
- ABSOLUTELY NO long paragraphs
- Max 2-3 short lines OR 2 sentences
- Prefer punchlines over explanations
- If text is longer than 2 lines -> force shorten
- Must feel sharp and memorable

---

### SLIDE 4 - CTA
- Must provoke opinion
- MUST be a question
- No generic "follow for more"

---

## TEMPLATE SEQUENCE RULES (MANDATORY)

- Produce EXACTLY ${requiredTemplateSequence.length} slides for this request.
- Slide 1 must be HOOK_A.
- Last slide must be CTA_FINAL.
- Middle slides must follow this exact templateId order:
${requiredTemplateSequence.map((templateId, index) => `${index + 1}. ${templateId}`).join("\n")}
- Do not add extra slides, do not reorder template IDs.

---

## CAPTION RULES

- First line = strong hook
- Maximum 6-8 lines total
- Each line must be short (mobile-friendly)
- Use "\\n" for line breaks (IMPORTANT)
- No double quotes inside text
- Conversational tone
- If it reads like an article -> rewrite shorter
- Avoid phrases like:
  - 'This isn't just...'
  - 'It's a powerful signal...'
- Prefer direct, human phrasing

## CAPTION STYLE EXAMPLE

Bad:
This is a powerful signal about industry trends...

Good:
This job is disappearing.\n\nNobody wants to do it anymore.\n\nBut demand?\n\nHigher than ever.\n\nWould you learn this skill?

Rules:
- Follow this tone and structure
- Prioritize short, punchy lines

Structure:
- Hook
- Context
- Insight
- Question

---

## HASHTAGS RULES

- 8-12 hashtags ONLY
- No duplicates
- No generic tags (#news, #breaking)
- Mix niche + topic-specific

---

## ANTI-GENERIC FILTER (STRICT)

Before returning output, check:

- If content sounds like a news summary -> rewrite
- If phrases are generic -> rewrite with stronger wording
- If tone is too formal -> make it more conversational
- If content feels safe -> make it slightly more bold
- If output feels predictable -> rewrite with stronger phrasing
- If tone is too informational -> make it more emotional or provocative
- If content lacks tension -> increase contrast

---

## JSON SAFETY RULES (CRITICAL)

- RETURN ONLY VALID JSON
- Escape all double quotes inside values
- Caption MUST use \\n for new lines
- No trailing commas
- No markdown
- No explanations

---

## INPUT

ACCOUNT:
Handle: ${sanitizedHandle}
Name: ${sanitizedDisplayName}
Bio: ${sanitizedBio}${relevanceCheck}

ARTICLE:
Title: ${sanitizeForPrompt(article.title, 200)}
Source: ${sanitizeForPrompt(article.source, 100)}
${/* NOTE: We use `description` (max ~300 chars) instead of `content` because GNews free tier truncates `content` at ~260 chars with a "[chars]" suffix. The description field reliably contains the full editorial summary. */""}Description: ${sanitizeForPrompt(article.description, 500)}

---

## OUTPUT FORMAT

${outputExample}

---

## HARD RULES

- NO clickbait lies
- NO generic phrases
- NO long paragraphs
- NO robotic tone
- MUST feel like real creator content

RETURN ONLY JSON.`;

  const aiLogger = new Logger();
  try {
    const result = await withTimeout(
      model.generateContent(prompt),
      geminiTimeoutMs,
      `Gemini API timeout after ${geminiTimeoutMs}ms`
    );
    const response = await result.response;
    let responseText = response.text();
    
    aiLogger.debug('ai-service', `Raw Gemini response (first 500 chars): ${responseText.substring(0, 500)}`);
    
    // Handle markdown-formatted JSON (sometimes Gemini wraps response in ```json...```)
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      aiLogger.debug('ai-service', 'Found JSON in markdown code block, extracting...');
      responseText = jsonMatch[1];
    }
    
    let json: unknown;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      // Write full response to a debug file for post-mortem analysis
      const debugPath = `./logs/gemini-response-${Date.now()}.txt`;
      ensureParentDirectoryExists(debugPath);
      fs.writeFileSync(debugPath, responseText);
      aiLogger.error('ai-service', `Failed to parse Gemini response as JSON. Full response saved to ${debugPath}`, {
        rawPreview: responseText.substring(0, 1000),
        parseError: parseErrorMessage,
      });
      throw new Error(`JSON parse error. Full response saved to ${debugPath}. Error: ${parseErrorMessage}`);
    }

    return validateGeneratedContent(json, requiredTemplateSequence);
  } catch (error) {
    aiLogger.error('ai-service', 'Gemini generation error', error);
    throw error;
  }
}
