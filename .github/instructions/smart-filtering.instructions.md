---
description: Smart news filtering, deduplication, and account relevance system
applyTo: "src/pipeline/{accountProfile,postHistory,newsFiltering}.ts"
---

# Smart News Filtering & Account Relevance

This document describes the account-aware content selection and filtering system that prevents duplicate posts and selects news relevant to your Instagram account niche.

## Overview

The pipeline now includes intelligent article selection before AI generation:

```
GNews API (10 articles)
    ↓
[Filter] Remove already-posted articles
    ↓
[Score] Rank by keyword relevance to account niche
    ↓
[Select] Pick best-fit article
    ↓
[AI] Generate carousel with account context
    ↓
[Record] Save to post history (prevent duplicates)
```

## Components

### 1. Account Profile (`src/pipeline/accountProfile.ts`)

Defines Instagram account identity and loaded from `.env`:

```typescript
interface AccountProfile {
  handle: string;              // @theinitial.dev
  displayName: string;         // The Initial Dev
  bio: string;                 // Account description
  niche: string[];             // ['technology', 'development', 'startup']
  accentColor: string;         // #3b82f6 (for branding)
  effects: string[];           // ['vignette', 'chromatic', 'halftone']
}
```

**Loading:**
```typescript
const profile = loadAccountProfile();  // Reads .env
const keywords = getAccountKeywords(profile);  // Extracts bio + niche words
```

### 2. Post History Tracker (`src/pipeline/postHistory.ts`)

Maintains JSON file (`post-history.json`) of all posted articles:

```typescript
hasBeenPosted(articleUrl: string): boolean;  // Check for duplicates
recordPost(article, batchId): void;          // Save after posting
getRecentPosts(days: 7): PostRecord[];       // Get last N days
clearHistory(): void;                         // For testing
```

**Storage Format:**
```json
[
  {
    "articleTitle": "Article Title",
    "articleUrl": "https://...",
    "postedAt": "2026-04-04T16:37:42Z",
    "batchId": "batch-1775320648371"
  }
]
```

**Behavior:**
- Keeps last 500 posts to prevent file bloat
- Checks URL to prevent reposts of exact same article
- Records posting timestamp for analytics

### 3. News Filtering (`src/pipeline/newsFiltering.ts`)

Scores and ranks articles by relevance:

#### Scoring Algorithm

Each article gets a relevance score based on:

| Match Type | Weight | Example |
|------------|--------|---------|
| Keyword in title | +10 | "AI" in title when "AI" is a niche keyword |
| Keyword in description | +5 | "AI" only in description |
| Has content | +5 | Article has title + description |
| Recent post penalty | -10 | If 3+ posts already from same niche this week |

**Example Scoring:**
```
Article 1: "OpenAI Releases New GPT Model"
  - Title match: "AI" (+10)
  - Title match: "release" concept (+0, common word)
  - Result: 15 → Rank #1

Article 2: "Stock Market Trends"
  - Title match: none (0)
  - Description mentions "tech sector" (+0, not exact match)
  - Result: 5 → Rank #3
```

#### Functions

```typescript
scoreArticleRelevance(article, keywords): { score, reasons }
// Returns score and human-readable reasons

filterAndRankArticles(articles, keywords): ScoredArticle[]
// Removes posted articles, scores remaining, returns ranked list

selectBestArticle(scored, strategy): ScoredArticle | null
// Picks one: 'top' (always best) or 'diverse' (random from top 3)

printScoringResults(scored): void
// Prints ranking for debug logging
```

## Configuration

All settings load from `.env`:

```env
# Account Identity
BRAND_HANDLE='@theinitial.dev'
BRAND_DISPLAY_NAME='The Initial Dev'
BRAND_BIO='Tech news, dev tools, startup insights for developers'
BRAND_NICHE='technology,development,startup,software-engineering,dev-tools'
BRAND_ACCENT_COLOR='#3b82f6'
BRAND_EFFECTS='vignette,chromatic,halftone'

# Pipeline Control
RENDER_FORMAT='mp4'           # or 'png'
NEWS_CATEGORY='technology'    # GNews category to fetch
```

**Values Are Used For:**
- `BRAND_HANDLE` → Written into carousel slides
- `BRAND_BIO` → Passed to Gemini for relevance-aware content generation
- `BRAND_NICHE` → Keywords extracted for article scoring
- `BRAND_EFFECTS` → Applied to carousel rendering
- `RENDER_FORMAT` → Sent to `/api/render` endpoint (MP4 or PNG)
- `NEWS_CATEGORY` → Sent to GNews API

## Data Flow in pipelineRun.ts

```typescript
// 1. Load account profile from env
const accountProfile = loadAccountProfile();
const keywords = getAccountKeywords(accountProfile);

// 2. Fetch articles from GNews
const articles = await fetchTopNews(NEWS_CATEGORY);

// 3. Filter & rank by relevance
const scored = filterAndRankArticles(articles, keywords);
printScoringResults(scored);

// 4. Select best article
const selected = selectBestArticle(scored, 'top');

// 5. Generate with account context
const aiData = await generatePostContentAI(article, accountProfile);
// ↑ Account profile passed to Gemini!

// 6. Render with format preference
const urls = await renderMedia(manifest, RENDER_FORMAT);

// 7. Record as posted
recordPost(article, batchId);
```

## AI Integration

Gemini now receives account context in the prompt:

```typescript
const prompt = `
  ACCOUNT:
  Handle: ${account.handle}
  Name: ${account.displayName}
  Bio: ${account.bio}
  Niche: ${account.niche.join(", ")}
  
  [This article is for ${account.handle}]
  [Ensure content aligns with this audience and tone]
  
  ARTICLE: ...
`;
```

**Result:** AI tailors content to account personality instead of generic carousel slides.

## Testing & Debugging

### View Filtered Articles
```bash
npm run pipeline
# Output shows:
# [filter] ⊘ Skipping already posted: "..."
# [scoring] 📊 Ranked 3 relevant articles:
#   1. [25] "Article Title" → 2 keywords + recent activity
#   2. [15] "Article Title" → 1 keyword in title
#   3. [10] "Article Title" → Generic tech news
```

### Clear Post History
```bash
# To reprocess same articles (dev/testing only):
rm post-history.json
```

### Check Post History
```bash
cat post-history.json | jq '.[] | {title: .articleTitle, date: .postedAt}'
```

## Known Limitations

1. **Keyword Extraction**: Simple word-based matching, no semantic understanding
   - Won't match synonyms ("AI" ≠ "artificial intelligence")
   - Fix: Could integrate TF-IDF or semantic search

2. **Category Limitation**: Only one news category per run
   - Fix: Support multi-category fetch with weighted scoring

3. **No Recency Bias**: Doesn't prefer newest articles
   - Fix: Add time-based decay (older articles = lower score)

4. **English Only**: Keyword extraction assumes English text
   - Fix: Add language detection before keyword extraction

## Future Enhancements

- [ ] Semantic search for synonyms ("AI" finds "machine learning")
- [ ] Multi-category fetching with niche-specific weights
- [ ] Engagement history tracking (which topics perform best)
- [ ] A/B testing variants of same article
- [ ] Custom keyword weights per account
- [ ] Integration with Instagram Insights API (which topics resonated)
