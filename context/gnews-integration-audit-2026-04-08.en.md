# GNews API Integration Audit — 2026-04-08 (EN)

This document audits the current GNews API integration, based on the actual implementation and official GNews API documentation and best practices.

---

## 1) CURRENT IMPLEMENTATION SUMMARY

### Endpoint Used

- **Top Headlines** (`/api/v4/top-headlines`)
- Current URL pattern: `?category={cat}&lang=en&country=us&max=10&apikey={key}`
- File: `src/pipeline/newsService.ts`

### Data flow

```
GNews /top-headlines (10 articles)
    → newsService.fetchTopNews()
        → mapToNewsArticle() (normalize)
            → newsFiltering.filterAndRankArticles()
                → scoreArticleRelevance() (keyword matching)
                    → selectBestArticle()
                        → aiService.generatePostContentAI()
```

### Mapping

GNews raw response → `NewsArticle` interface:

| GNews field | Internal field | Note |
|---|---|---|
| `title` | `title` | Direct mapping |
| `description` | `description` | Fallback to `''` if null/undefined |
| `content` | `content` | Fallback to `description` if content is missing |
| `url` | `url` | Used as dedupe key |
| `image` | `imageUrl` | Fallback to `undefined` |
| `publishedAt` | `publishedAt` | Stored as string |
| `source.name` | `source` | Fallback to `'Unknown Source'` |

### Unused GNews response fields

| Field | Potential use |
|---|---|
| `id` | Unique article identifier, more precise dedupe than URL |
| `lang` | Multi-language content filtering/validation |
| `source.id` | Source-level deduplication/blacklisting |
| `source.url` | Source credibility scoring |
| `source.country` | Geo-aware content selection |
| `totalArticles` | Quota monitoring, pagination decisions |

---

## 2) GNews API PARAMETERS — USED vs AVAILABLE

### Top Headlines endpoint — full parameter map

| Parameter | In API | Used in code | Value | Note |
|---|---|---|---|---|
| `category` | ✅ | ✅ | `NEWS_CATEGORY` env (default `technology`) | 9 categories available |
| `lang` | ✅ | ✅ | `en` (hardcoded) | Not configurable |
| `country` | ✅ | ✅ | `us` (hardcoded) | Not configurable |
| `max` | ✅ | ✅ | `10` (hardcoded) | Free plan limit 10, paid 25-100 |
| `apikey` | ✅ | ✅ | `.env` | ✅ correct |
| `q` | ✅ | ❌ | — | Optional keyword filter in top-headlines; can send niche query |
| `nullable` | ✅ | ❌ | — | Can set `description,content` to explicitly allow nulls |
| `from` | ✅ | ❌ | — | Date filter — exclude old articles |
| `to` | ✅ | ❌ | — | Date filter |
| `page` | ✅ | ❌ | — | Pagination — fetch more articles |
| `truncate` | ✅ | ❌ | — | Content truncation control |

### Search endpoint — not used

| Parameter | Usefulness |
|---|---|
| `q` (required) | Precise search with niche keywords (AND/OR/NOT operators) |
| `in` | Target selection for `title,description` — increases relevance |
| `sortby` | GNews-side `relevance` sorting |
| `from/to` | Date range filter |

**Key observation:** The current system only uses top-headlines. Using the Search endpoint could significantly increase niche relevance, as sending niche keywords directly to GNews improves the article pool quality before client-side scoring.

---

## 3) RATE LIMITING & QUOTA — GAPS

### GNews plan limits (official docs)

| Plan | Requests/day | Max articles/request | Rate limit | Content | Delay |
|---|---|---|---|---|---|
| **Free** | 100 | 10 | 1 req/s | Truncated | 12h delay |
| **Essential** (€49.99/mo) | 1,000 | 25 | 10 req/s | Full | Real-time |
| **Business** (€99.99/mo) | 5,000 | 50 | 10 req/s | Full | Real-time |
| **Enterprise** (€249.99/mo) | 25,000 | 100 | 10 req/s | Full | Real-time |

### Gaps in current code

| Problem | Impact | Priority |
|---|---|---|
| **No rate limit handling** (429 status) | `fetch` throws, but `retryPolicy` only matches `network`/`timeout`/`chrome` — 429 is not retried | 🔴 High |
| **No quota exhaustion handling** (403 status) | When 100 daily requests are used, generic error is thrown, not surfaced | 🔴 High |
| **No request throttling** | Free plan is 1 req/s, rapid triggers risk 429 | 🟡 Medium |
| **No quota tracking** | No way to know remaining requests, no proactive gating | 🟡 Medium |
| **Hardcoded `max=10`** | Free plan limit is 10 — if plan is upgraded, code change needed | 🟢 Low |

### Specific error status codes — current code behavior

```typescript
// Current implementation (newsService.ts):
if (!response.ok) {
    const error = await response.text();
    throw new Error(`GNews API Error: ${response.status} - ${error}`);
}
```

This is generic error handling. There is no behavior for specific status codes:

| Status | Expected behavior | Current behavior |
|---|---|---|
| **400** (Bad Request) | Log + check parameters | Generic throw |
| **401** (Unauthorized) | API key error — retry is pointless | Generic throw (may retry) |
| **403** (Forbidden) | Quota exhausted — stop until next day | Generic throw |
| **429** (Too Many Requests) | Throttle + exponential backoff retry | Generic throw |
| **500** (Server Error) | Retry with delay | Generic throw |
| **503** (Service Unavailable) | Retry with longer delay | Generic throw |

---

## 4) DATA QUALITY & CONTENT HANDLING

### Free plan content truncation

- GNews Free plan automatically truncates the `content` field.
- There is no note/warning about this in the current code.
- `content` is sent to the AI prompt — truncated content can cause poor AI output.
- In `mapToNewsArticle`, `content: raw.content || raw.description` fallback is used — this is correct, but the impact of truncated content on AI quality is not logged.

### `nullable` parameter not used

- By default, GNews does not return articles with null `description` or `content`.
- Adding `nullable=description,content` could increase the article pool.
- However, `newsFiltering.ts` no longer crashes on null `description` (see lesson-learned).

### No `publishedAt` parsing

- `publishedAt` is stored as a string and written to `post-history.json`.
- It is never parsed as a `Date` object or used for freshness scoring.
- GNews `from/to` parameters could filter old articles at the API level — more efficient than client-side scoring.

### `image` field usage

- `mapToNewsArticle` stores `image` as `imageUrl`.
- `imageUrl` is used in the AI prompt (as background image in HOOK_A template).
- Image URL validity is not checked (risk of broken links).

---

## 5) SEARCH ENDPOINT — UNUSED POTENTIAL

### Why is it valuable?

The current system only uses `top-headlines`, which returns general trending news — relevance to the account niche may be low. Thus, client-side `scoreArticleRelevance` filtering is required.

**Using the Search endpoint:**
- Niche keywords (`startup AND (technology OR developer)`) can be sent directly to GNews
- `in=title,description` can target match fields
- `sortby=relevance` lets GNews rank the best-matching articles
- Reduces client-side scoring load, improves article pool quality

### Potential dual-endpoint strategy

```
1. fetchTopNews(category) — trending news (current)
2. fetchSearchNews(nicheQuery) — niche-specific news (new)
3. Merge + dedupe (URL-based)
4. scoreArticleRelevance() — current scoring
5. selectBestArticle()
```

This approach broadens the article pool, but doubles quota usage.

---

## 6) RETRY POLICY — IN GNews CONTEXT

### Current `retryPolicy.ts` mismatches for GNews

```typescript
// retryPolicy.ts default isRetryable:
normalized.includes('econnreset') ||
normalized.includes('econnrefused') ||
normalized.includes('etimedout') ||
normalized.includes('timeout') ||
normalized.includes('network') ||
normalized.includes('chrome') ||
normalized.includes('renderer')
```

This regex does not catch GNews errors:

| GNews error | Should retry? | Current retry behavior |
|---|---|---|
| `GNews API Error: 429` | ✅ Yes (after throttle) | ❌ Not retried |
| `GNews API Error: 500` | ✅ Yes | ❌ Not retried |
| `GNews API Error: 503` | ✅ Yes (with longer delay) | ❌ Not retried |
| `GNews API Error: 403` (quota) | ❌ No — pointless until next day | ❌ Not retried (correct) |
| `GNews API Error: 401` (auth) | ❌ No | ❌ Not retried (correct) |

### `newsService.ts` does not use retry wrapper

`fetchTopNews` does not use `executeWithRetry`. It calls `fetch` directly and throws on error. No retry is attempted for transient GNews errors.

---

## 7) CONFIGURATION AUDIT

### Hardcoded values

| Parameter | Value | Should be |
|---|---|---|
| `lang` | `'en'` (hardcoded) | Configurable via `.env` (`GNEWS_LANG`) |
| `country` | `'us'` (hardcoded) | Configurable via `.env` (`GNEWS_COUNTRY`) |
| `max` | `10` (hardcoded) | Configurable via `.env` (`GNEWS_MAX_ARTICLES`) |
| `GNEWS_URL` | `top-headlines` (hardcoded) | Should add Search endpoint |

### API key management

- ✅ `GNEWS_API_KEY` is read from `.env`
- ✅ If API key is missing, `console.warn` + returns empty array (graceful fallback)
- ❌ If API key is missing, warning uses `console.warn` — should use structured logger (`Logger` class)
- ❌ No API key rotation/monitoring

---

## 8) TEST COVERAGE

### Existing tests

- `__tests__/newsFiltering.test.ts`: Scoring logic + null description handling
- But **no unit test for newsService.ts**

### Test gaps

| Gap | Priority |
|---|---|
| `fetchTopNews` not tested with mock API responses | 🔴 High |
| HTTP error status code handling not tested (403, 429, 500) | 🔴 High |
| Graceful fallback when API key is missing not tested | 🟡 Medium |
| `mapToNewsArticle` edge cases not tested (missing fields) | 🟡 Medium |

---

## 9) RECOMMENDATIONS — PRIORITIZED

### 🔴 High priority (affects stability)

1. **Add GNews-specific error handling**
   - 429 → retry with exponential backoff (1s, 2s, 4s)
   - 403 → log quota exhaustion, skip run gracefully, schedule next run for next day
   - 401 → log auth failure, alert
   - 500/503 → retry with delay

2. **Wrap `fetchTopNews` with `executeWithRetry`**
   - Adjust `isRetryable` for GNews status codes
   - Use `retryDelayMs` from 429 response header if available

3. **Write unit tests for `newsService.ts`**
   - Mock `fetch` and test behavior for each status code

### 🟡 Medium priority (improves quality)

4. **Move hardcoded parameters to `.env`**
   - `GNEWS_LANG`, `GNEWS_COUNTRY`, `GNEWS_MAX_ARTICLES`

5. **Add Search endpoint integration**
   - `fetchSearchNews(query)` function
   - Compose query from account niche keywords
   - Merge top-headlines + search results

6. **Use `from` parameter**
   - Filter for last 24-48h news at API level
   - Reduces need for client-side freshness scoring

7. **Log `totalArticles` response field**
   - For quota monitoring and article availability tracking

### 🟢 Low priority (optimization)

8. **Map unused GNews fields**
   - `id` — more precise dedupe than URL
   - `lang` — content language validation
   - `source.id` / `source.country` — source-level analytics

9. **Add `nullable=description,content` parameter**
   - Expands article pool, but test null handling first

10. **Add content truncation warning**
    - If using free plan, log before sending truncated content to AI

---

## 10) SUMMARY

| Area | Status | Note |
|---|---|---|
| Core integration | ✅ Works | Top-headlines + mapping + scoring |
| Error handling | 🔴 Poor | Generic `throw`, no status-specific behavior |
| Rate/quota management | 🔴 Missing | No throttling, no quota tracking |
| Retry policy fit | 🔴 Missing | GNews errors not retried |
| Configuration | 🟡 Partial | lang/country/max hardcoded |
| Search endpoint | ❌ Not used | Would improve niche relevance |
| Test coverage | 🔴 Poor | No tests for newsService.ts |
| Data mapping | 🟡 Good | `id`, `lang`, `source.id` not used |
| Content quality | 🟡 Partial | No warning for free plan truncation |

**Overall assessment:** GNews integration is functionally working, but lacks production-grade robustness in error handling, retry, and quota management. The most critical risk: improper handling of 429/403 errors can cause the pipeline to fail suddenly or waste daily quota.
