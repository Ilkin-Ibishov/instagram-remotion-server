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

  const prompt = `You are an Instagram content expert. Transform this news into a 4-slide carousel JSON.

ACCOUNT:
Handle: ${account.handle}
Name: ${account.displayName}
Bio: ${account.bio}${relevanceCheck}

ARTICLE:
Title: ${article.title}
Source: ${article.source}
Description: ${article.description}

INSTRUCTION: Return ONLY this JSON structure with all fields filled:

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
          "headline": "Breaking News Title",
          "subheadline": "Compelling subtitle here",
          "imageUrl": ${article.imageUrl ? `"${article.imageUrl}"` : 'null'}
        }
      },
      {
        "templateId": "CONTENT_LISTICLE",
        "data": {
          "title": "Key Points",
          "items": ["First important point", "Second key detail", "Third fact", "Fourth insight"],
          "footnote": "Source: ${article.source}"
        }
      },
      {
        "templateId": "CONTENT_GENERIC",
        "data": {
          "title": "Full Story",
          "body": "A clear 2-3 sentence explanation of what happened and why it matters.",
          "highlight": "One powerful quote or key statement"
        }
      },
      {
        "templateId": "CTA_FINAL",
        "data": {
          "callToAction": "Save & Share",
          "subtext": "Follow ${brandConfig.brandHandle} for more"
        }
      }
    ]
  },
  "caption": "Engaging Instagram caption with relevant emojis about the news story",
  "hashtags": "#News #Breaking #TopStory #Current #Updates #Alert #Article #Coverage #Trending #Story"
}

Rules:
- Return ONLY valid JSON
- Fill every field with real content
- NO empty objects or arrays
- NO markdown formatting
- NO explanations`;

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
      console.error('❌ Failed to parse Gemini response as JSON');
      console.error('Raw response (first 1000 chars):', responseText.substring(0, 1000));
      console.error('Full error:', parseError);
      
      // Write full response to a debug file
      const fs = require('fs');
      const debugPath = `./logs/gemini-response-${Date.now()}.txt`;
      fs.writeFileSync(debugPath, responseText);
      console.error(`Full response written to: ${debugPath}`);
      
      throw new Error(`JSON parse error. Full response saved to ${debugPath}. Error: ${parseError.message}`);
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
