# GNews API Implementation Guide — 2026-04-08

This document outlines the enhanced GNews API integration implemented across the system, including robust error handling, comprehensive configuration, and improved data quality.

## Overview

The GNews integration has been upgraded to production-grade robustness, addressing all critical gaps identified in the April 8, 2026 audit. The system now supports:

- **Intelligent retry logic** with exponential backoff and Retry-After header support
- **Full environment configurability** for all GNews parameters
- **Dual-endpoint strategy** (top-headlines + search) for improved article relevance
- **Data quality enhancements** including content truncation detection and image validation
- **Comprehensive test coverage** for all error scenarios and edge cases

## Configuration

All GNews parameters are now fully configurable via `.env`:

```env
# GNews API Authorization
GNEWS_API_KEY=your_api_key_here

# GNews API Configuration
GNEWS_LANG=en                                    # Language code (en, de, fr, etc.)
GNEWS_COUNTRY=us                                # Country code (us, gb, de, etc.)
GNEWS_MAX_ARTICLES=10                           # Max articles per request (free: 10, paid: 25-100)
GNEWS_URL=https://gnews.io/api/v4/top-headlines # API endpoint URL
```

**Migration note:** If upgrading from previous versions, ensure these environment variables are set in your deployment. Default values are safely applied if not provided.

## API Endpoints

### fetchTopNews(category)

Fetches trending articles from the GNews top-headlines endpoint.

```typescript
// Fetch technology headlines
const articles = await fetchTopNews('technology');
```

**Supported categories:** general, world, nation, business, technology, entertainment, sports, science, health

**Retry behavior:** Retries on 429 (rate limit), 500, 503 with exponential backoff. Does NOT retry on 401 (auth) or 403 (quota).

### fetchSearchNews(query, options)

Fetches articles matching niche keywords using the GNews search endpoint with advanced operators.

```typescript
// Search for startup and technology articles
const articles = await fetchSearchNews('startup AND (technology OR developer)', {
  sortby: 'relevance',
  from: '2026-04-01T00:00:00Z',
  to: '2026-04-08T23:59:59Z',
  maxResults: 25,
});
```

**Query syntax supports:**
- Logical operators: `AND`, `OR`, `NOT`
- Parentheses for grouping: `(Apple AND iPhone) OR (Samsung AND Galaxy)`
- Exact phrase search: `"exact phrase"`

**Options:**
- `sortby`: `'publishedAt'` or `'relevance'` (default: `'relevance'`)
- `from`: ISO 8601 date string (e.g., `'2026-04-01T00:00:00Z'`)
- `to`: ISO 8601 date string
- `maxResults`: Override the default max articles

### mergeAndDedupeArticles(headlines, search)

Merges and deduplicates articles from both endpoints, prioritizing search results (higher relevance).

```typescript
const allArticles = mergeAndDedupeArticles(headlines, searchResults);
```

## Error Handling & Retry Strategy

### Retry-eligible errors

| Status | Retryable | Behavior |
|---|---|---|
| 429 | ✅ Yes | Retry with exponential backoff + Retry-After header if present |
| 500 | ✅ Yes | Retry with exponential backoff |
| 503 | ✅ Yes | Retry with exponential backoff |
| 401 | ❌ No | Log auth failure, fail immediately (no retry) |
| 403 | ❌ No | Log quota exhaustion, fail immediately (no retry) |
| Network errors | ✅ Yes | Retry with backoff (timeout, ECONNRESET, etc.) |

### Structured logging

All errors are logged with actionable details:

```
[ERROR] [gnews] GNews API Error: 429
  {
    status: 429,
    error: "Too Many Requests",
    url: "https://gnews.io/api/v4/...",
    retryAfterMs: 2000
  }
```

## Data Quality

### Content truncation detection

The system detects when GNews returns truncated content (Free plan limitation) and logs warnings:

```
[WARN] [gnews-content] Article content appears truncated (GNews Free plan)
  { title: "Article Title" }
```

Free plan users should be aware that article content quality may be reduced compared to paid plans.

### Image URL validation

Image URLs are validated before use. Invalid or malformed URLs are logged as warnings:

```
[WARN] [gnews-content] Article imageUrl is invalid or malformed
  { title: "Article Title", providedUrl: "invalid-url" }
```

### Null field handling

The system gracefully handles null or missing fields:

- `description`: Defaults to empty string
- `content`: Falls back to `description` if missing
- `imageUrl`: Set to `undefined` if invalid
- `source.name`: Defaults to "Unknown Source"

## Multi-endpoint strategy

For improved article relevance, the pipeline can optionally use both endpoints:

```typescript
const headlines = await fetchTopNews(category);
const niche = await fetchSearchNews(accountNiche);
const combined = mergeAndDedupeArticles(headlines, niche);
const selected = selectBestArticle(combined);
```

This approach:
- **Broadens** the article pool (more candidates)
- **Improves** relevance via GNews relevance sorting
- **Reduces** client-side CPU by pre-filtering at API level
- **Uses** more quota (2x requests, but more targeted)

## Typical quotas

| Plan | Requests/day | Articles/request | Rate limit | Content |
|---|---|---|---|---|
| Free | 100 | 10 | 1 req/s | Truncated |
| Essential | 1,000 | 25 | 10 req/s | Full |
| Business | 5,000 | 50 | 10 req/s | Full |
| Enterprise | 25,000 | 100 | 10 req/s | Full |

**Free plan considerations:**
- Max 100 requests per day — plan carefully
- 1 request per second rate limit — throttle requests
- Content is automatically truncated
- 12-hour delay on articles

## Test Coverage

Comprehensive unit tests cover:
- Successful API responses
- All error status codes (400, 401, 403, 429, 500, 503)
- Retry behavior with various failure scenarios
- Null/missing field handling
- Invalid response structure detection
- Article merging and deduplication logic
- Image URL validation

Run tests with: `npm test -- __tests__/newsService.test.ts`

## Observability

The system logs:

1. **Configuration warnings** — missing or non-standard env values
2. **Error details** — status codes, retry attempts, delays
3. **Content issues** — truncation, invalid fields, validation failures
4. **Retry decisions** — attempt counts, delays, final outcomes
5. **Merge statistics** — deduplication counts, source order

This information is available in `logs/run-*.log.json` for analysis and debugging.

## Migration from previous versions

If upgrading existing deployments:

1. **Add new env variables** to `.env` or deployment config (or rely on defaults):
   - `GNEWS_LANG`, `GNEWS_COUNTRY`, `GNEWS_MAX_ARTICLES`, `GNEWS_URL`

2. **Update code** to call `fetchTopNews()` and `fetchSearchNews()` as before — API is backward-compatible.

3. **Enable search endpoint** (optional) — modify pipeline to call both endpoints and merge results for improved relevance.

4. **Review test coverage** — run `npm test` to ensure all error scenarios are handled.

5. **Monitor logs** — watch for new warning categories (e.g., `gnews-config`, `gnews-content`) to identify configuration issues.

## Future enhancements

Consider:
- Per-account API key support for multi-account scaling
- Circuit breaker pattern for repeated failures
- Dashboard/metrics endpoint for quota and error monitoring
- Scheduled API key rotation
- Cache layer for frequently searched articles
