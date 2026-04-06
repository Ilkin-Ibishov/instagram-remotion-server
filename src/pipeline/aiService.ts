import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { NewsArticle, GeneratedContent } from "./types";
import type { AccountProfile } from "./accountProfile";
import { config as brandConfig } from "./config";
import * as dotenv from "dotenv";

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

export async function generatePostContentAI(
  article: NewsArticle,
  accountProfile?: AccountProfile
): Promise<GeneratedContent> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY not found in environment variables. Please add it to .env");
  }

  const account = accountProfile || brandConfig.accountProfile;

  // Build relevance instruction if account context is available
  const relevanceCheck = account
    ? `\nRELEVANCE NOTE: This content is for ${account.handle} (${account.displayName}).
Account focus: ${account.bio}.
Account niche: ${account.niche.join(", ")}.
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

BUT ALSO:

- DO NOT invent facts, quotes, numbers, or entities
- DO NOT exaggerate beyond the given article
- If information is missing -> stay general, do NOT guess
- Use tension, NOT misinformation

---

## CONTENT STRATEGY

### SLIDE 1 - HOOK (SCROLL STOPPER)
- Short, punchy, curiosity-driven
- Must be grounded in actual article
- No generic titles

---

### SLIDE 2 - TENSION
- NOT boring bullet points
- Max 4 lines
- Each line <= 12 words
- Escalation feeling

---

### SLIDE 3 - PAYOFF
- Max 2-3 short lines OR 2 sentences
- No long paragraphs
- Focus on WHY it matters

---

### SLIDE 4 - CTA
- Must provoke opinion
- MUST be a question
- No generic "follow for more"

---

## CAPTION RULES

- First line = strong hook
- Short lines only
- Use "\\n" for line breaks (IMPORTANT)
- No double quotes inside text
- Conversational tone

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
Handle: ${account.handle}
Name: ${account.displayName}
Bio: ${account.bio}${relevanceCheck}

ARTICLE:
Title: ${article.title}
Source: ${article.source}
Description: ${article.description}

---

## OUTPUT FORMAT

{
  "manifest": {
    "format": "instagram_carousel",
    "globalBranding": {
      "accentColor": "${brandConfig.brandAccentColor}",
      "handle": "${brandConfig.brandHandle}",
      "effects": ${JSON.stringify(brandConfig.brandEffects)}
    },
    "carousel": [
      {
        "templateId": "HOOK_A",
        "data": {
          "headline": "...",
          "subheadline": "...",
          "imageUrl": ${article.imageUrl ? `"${article.imageUrl}"` : 'null'}
        }
      },
      {
        "templateId": "CONTENT_LISTICLE",
        "data": {
          "title": "...",
          "items": ["...", "...", "...", "..."],
          "footnote": "Source: ${article.source}"
        }
      },
      {
        "templateId": "CONTENT_GENERIC",
        "data": {
          "title": "...",
          "body": "...",
          "highlight": "..."
        }
      },
      {
        "templateId": "CTA_FINAL",
        "data": {
          "callToAction": "...",
          "subtext": "Reply in comments"
        }
      }
    ]
  },
  "caption": "...",
  "hashtags": "..."
}

---

## HARD RULES

- NO clickbait lies
- NO generic phrases
- NO long paragraphs
- NO robotic tone
- MUST feel like real creator content

RETURN ONLY JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text();
    
    console.log('📋 Raw Gemini Response (first 500 chars):', responseText.substring(0, 500));
    
    // Handle markdown-formatted JSON (sometimes Gemini wraps response in ```json...```)
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      console.log('ℹ️ Found JSON in markdown code block, extracting...');
      responseText = jsonMatch[1];
    }
    
    let json;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.error('❌ Failed to parse Gemini response as JSON');
      console.error('Raw response (first 1000 chars):', responseText.substring(0, 1000));
      console.error('Full error:', parseError);
      
      // Write full response to a debug file
      const fs = require('fs');
      const debugPath = `./logs/gemini-response-${Date.now()}.txt`;
      fs.writeFileSync(debugPath, responseText);
      console.error(`Full response written to: ${debugPath}`);
      
      throw new Error(`JSON parse error. Full response saved to ${debugPath}. Error: ${parseErrorMessage}`);
    }
    
    // Validate that carousel has data
    if (json.manifest && json.manifest.carousel) {
      json.manifest.carousel.forEach((slide: any, index: number) => {
        if (!slide.data || Object.keys(slide.data).length === 0) {
          console.warn(`⚠️ WARNING: Slide ${index} (${slide.templateId}) has empty data object`);
          console.warn('Full response was:', JSON.stringify(json, null, 2));
        }
      });
    }
    
    return json as GeneratedContent;
  } catch (error) {
    console.error("❌ Gemini Generation Error:", error);
    console.error("Error message:", (error as Error).message);
    console.error("Full error details:", error);
    throw error;
  }
}
