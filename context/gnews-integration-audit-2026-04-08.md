# GNews API Integration Audit — 2026-04-08

Bu sənəd GNews API inteqrasiyasının mövcud implementasiyasını, GNews API-nin rəsmi sənədlərinə və best practice-lərə əsasən audit edir.

---

## 1) MÖVCUD İMPLEMENTASİYA XÜLASƏSİ

### İstifadə olunan endpoint

- **Top Headlines** (`/api/v4/top-headlines`)
- Cari URL pattern: `?category={cat}&lang=en&country=us&max=10&apikey={key}`
- Fayl: `src/pipeline/newsService.ts`

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

| GNews field | Internal field | Qeyd |
|---|---|---|
| `title` | `title` | Birbaşa |
| `description` | `description` | `''` fallback null/undefined üçün |
| `content` | `content` | `description`-a fallback edir content yoxdursa |
| `url` | `url` | Dedupe key kimi istifadə olunur |
| `image` | `imageUrl` | `undefined` fallback |
| `publishedAt` | `publishedAt` | Birbaşa string olaraq saxlanır |
| `source.name` | `source` | `'Unknown Source'` fallback |

### İstifadə olunmayan GNews response fields

| Field | Nə üçün yararlı ola bilər |
|---|---|
| `id` | Unique article identifier, dedupe üçün URL əvəzinə daha dəqiq |
| `lang` | Multi-language content filtering / validation |
| `source.id` | Source-level deduplication / blacklisting |
| `source.url` | Source credibility scoring |
| `source.country` | Geo-aware content selection |
| `totalArticles` | Quota monitoring, pagination qərarları |

---

## 2) GNews API PARAMETRLƏRİ — İSTİFADƏ vs MÖVCUD

### Top Headlines endpoint — tam parametr xəritəsi

| Parametr | API-da var | Kodda istifadə | Dəyəri | Qeyd |
|---|---|---|---|---|
| `category` | ✅ | ✅ | `NEWS_CATEGORY` env (default `technology`) | 9 kateqoriya mövcuddur |
| `lang` | ✅ | ✅ | `en` (hardcoded) | Konfiqurasiya oluna bilmir |
| `country` | ✅ | ✅ | `us` (hardcoded) | Konfiqurasiya oluna bilmir |
| `max` | ✅ | ✅ | `10` (hardcoded) | Free plan limiti 10, paid 25-100 |
| `apikey` | ✅ | ✅ | `.env` | ✅ düzgün |
| `q` | ✅ | ❌ | — | Top headlines-da optional keyword filter; niche-ə uyğun query göndərmək olar |
| `nullable` | ✅ | ❌ | — | `description,content` set edərək null dəyərləri explicit qəbul etmək olar |
| `from` | ✅ | ❌ | — | Tarix filtri — köhnə xəbərləri istisna etmək üçün |
| `to` | ✅ | ❌ | — | Tarix filtri |
| `page` | ✅ | ❌ | — | Pagination — daha çox article əldə etmək üçün |
| `truncate` | ✅ | ❌ | — | Content truncation kontrolu |

### Search endpoint — heç istifadə olunmur

| Parametr | Yararlılıq |
|---|---|
| `q` (required) | Niche keyword-lərlə dəqiq axtarış (AND/OR/NOT operatorları) |
| `in` | `title,description` target seçimi — relevance artırır |
| `sortby` | `relevance` sıralaması GNews tərəfindən |
| `from/to` | Tarix aralığı filtri |

**Əsas müşahidə:** Mövcud sistem yalnız top-headlines istifadə edir. Search endpoint istifadəsi niche relevance-ı əhəmiyyətli dərəcədə artıra bilər, çünki niche keyword-ləri birbaşa GNews query-sinə daxil etmək scoring-dən əvvəl article pool keyfiyyətini yaxşılaşdırar.

---

## 3) RATE LIMITING və QUOTA — GAPS

### GNews plan limitləri (rəsmi sənəd)

| Plan | Requests/gün | Max articles/sorğu | Rate limit | Content | Delay |
|---|---|---|---|---|---|
| **Free** | 100 | 10 | 1 req/s | Truncated | 12 saat gecikmə |
| **Essential** (€49.99/ay) | 1,000 | 25 | 10 req/s | Full | Real-time |
| **Business** (€99.99/ay) | 5,000 | 50 | 10 req/s | Full | Real-time |
| **Enterprise** (€249.99/ay) | 25,000 | 100 | 10 req/s | Full | Real-time |

### Mövcud koddakı boşluqlar

| Problem | Təsir | Prioritet |
|---|---|---|
| **Rate limit handling yoxdur** (429 status) | `fetch` error atır, amma `retryPolicy` yalnız `network`/`timeout`/`chrome` match edir — 429 retry olunmur | 🔴 Yüksək |
| **Quota exhaustion handling yoxdur** (403 status) | Gün ərzindəki 100 request bitəndə generic error atılır, yuxarıda anlaşılmır | 🔴 Yüksək |
| **Request throttling yoxdur** | Free plan 1 req/s limit edir, rapid trigger-lərdə 429 riski | 🟡 Orta |
| **Quota tracking yoxdur** | Neçə request qaldığını bilmirik, proactive gating yoxdur | 🟡 Orta |
| **Hardcoded `max=10`** | Free planda 10 limitdir — plan yüksəlsə kodda dəyişiklik tələb olunur | 🟢 Aşağı |

### Spesifik error status kodları — mövcud koddakı davranış

```typescript
// Cari implementasiya (newsService.ts):
if (!response.ok) {
    const error = await response.text();
    throw new Error(`GNews API Error: ${response.status} - ${error}`);
}
```

Bu ümumi error handling-dir. Spesifik status kodlarına uyğun heç bir davranış yoxdur:

| Status | Gözlənilən davranış | Mövcud davranış |
|---|---|---|
| **400** (Bad Request) | Log + parametrləri yoxla | Generic throw |
| **401** (Unauthorized) | API key xətası — retry mənasızdır | Generic throw (retry cəhdi ola bilər) |
| **403** (Forbidden) | Quota bitib — gün sonunadək dayandır | Generic throw |
| **429** (Too Many Requests) | Throttle + exponential backoff retry | Generic throw |
| **500** (Server Error) | Retry with delay | Generic throw |
| **503** (Service Unavailable) | Retry with longer delay | Generic throw |

---

## 4) DATA KEYFİYYƏTİ VƏ CONTENT HANDLING

### Free plan content truncation

- GNews Free plan `content` field-ini avtomatik truncate edir.
- Mövcud kodda bu haqqında heç bir qeyd/warning yoxdur.
- `content` AI prompt-a ötürülür — truncated content keyfiyyətsiz AI çıxışına səbəb ola bilər.
- `mapToNewsArticle` funksiyasında `content: raw.content || raw.description` fallback var — content yoxdursa description istifadə olunur. Bu düzgündür, amma truncated content-in AI keyfiyyətinə təsiri loglanmır.

### `nullable` parametri istifadə olunmur

- GNews default olaraq `description` və `content` null dəyərli article-ları geri qaytarmır.
- `nullable=description,content` parametrini əlavə etsək daha çox article əldə edə bilərik.
- Amma `newsFiltering.ts` artıq null `description` ilə crash etmir (lesson-learned qeydində düzəlib).

### `publishedAt` parsing yoxdur

- `publishedAt` string olaraq saxlanır və `post-history.json`-a yazılır.
- Amma heç vaxt `Date` obyektinə parse edilib freshness scoring üçün istifadə olunmur.
- GNews `from/to` parametrləri ilə köhnə article-ları API səviyyəsində filtrləmək olar — client-side scoring-dən daha səmərəlidir.

### `image` field istifadəsi

- `mapToNewsArticle` `image` → `imageUrl` kimi saxlayır.
- Amma AI prompt-da `imageUrl` istifadə olunur (HOOK_A template-ində background image kimi).
- Image URL-in validity-si yoxlanılmır (broken link riski).

---

## 5) SEARCH ENDPOINT — İSTİFADƏ OLUNMAYAN İMKAN

### Niyə dəyərlidir?

Mövcud sistem yalnız `top-headlines` istifadə edir. Bu endpoint ümumi trending xəbərləri qaytarır — account niche-ilə relevance aşağı ola bilər. Buna görə client-side `scoreArticleRelevance` ilə filtr tələb olunur.

**Search endpoint** istifadəsi ilə:
- Niche keyword-ləri (`startup AND (technology OR developer)`) birbaşa GNews query-sinə göndərilə bilər
- `in=title,description` ilə match hədəfi seçilə bilər
- `sortby=relevance` ilə GNews özü ən uyğun article-ları sıralayar
- Client-side scoring-in yükü azalar, article pool keyfiyyəti artar

### Potensial dual-endpoint strategiyası

```
1. fetchTopNews(category) — trending xəbərlər (mövcud)
2. fetchSearchNews(nicheQuery) — niche-specific xəbərlər (yeni)
3. Merge + dedupe (URL-based)
4. scoreArticleRelevance() — mövcud scoring
5. selectBestArticle()
```

Bu yanaşma article pool-u genişləndirər, amma quota istifadəsini 2x artırar.

---

## 6) RETRY POLICY — GNews KONTEKSTINDƏ

### Mövcud `retryPolicy.ts` GNews ilə uyğunsuzluqları

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

Bu regex GNews xətalarını tutmur:

| GNews error | Retry edilməli? | Mövcud retry davranışı |
|---|---|---|
| `GNews API Error: 429` | ✅ Bəli (throttle sonrası) | ❌ Retry olunmur |
| `GNews API Error: 500` | ✅ Bəli | ❌ Retry olunmur |
| `GNews API Error: 503` | ✅ Bəli (uzun delay ilə) | ❌ Retry olunmur |
| `GNews API Error: 403` (quota) | ❌ Xeyr — gün sonunadək faydasız | ❌ Retry olunmur (düzgün) |
| `GNews API Error: 401` (auth) | ❌ Xeyr | ❌ Retry olunmur (düzgün) |

### `newsService.ts` retry ilə wrapper istifadə etmir

`fetchTopNews` funksiyası `executeWithRetry` wrapper-ini istifadə etmir. Birbaşa `fetch` çağırır və xəta atır. Transient GNews xətaları üçün retry heç cəhd olunmur.

---

## 7) KONFİQURASİYA AUDİTİ

### Hardcoded dəyərlər

| Parametr | Dəyər | Olmalıdır |
|---|---|---|
| `lang` | `'en'` (hardcoded) | `.env` ilə konfiqurasiya (`GNEWS_LANG`) |
| `country` | `'us'` (hardcoded) | `.env` ilə konfiqurasiya (`GNEWS_COUNTRY`) |
| `max` | `10` (hardcoded) | `.env` ilə konfiqurasiya (`GNEWS_MAX_ARTICLES`) |
| `GNEWS_URL` | `top-headlines` (hardcoded) | Search endpoint əlavə olunmalıdır |

### API key idarəsi

- ✅ `GNEWS_API_KEY` `.env`-dən oxunur
- ✅ API key yoxdursa `console.warn` + boş massiv qaytarır (graceful fallback)
- ❌ API key yoxdursa warn log-u `console.warn` istifadə edir — structured logger (`Logger` class) ilə əvəz olunmalıdır
- ❌ API key rotation / monitoring yoxdur

---

## 8) TEST COVERAGE

### Mövcud testlər

- `__tests__/newsFiltering.test.ts`: Scoring logic + null description handling
- Amma **newsService.ts üçün unit test yoxdur**

### Test boşluqları

| Boşluq | Prioritet |
|---|---|
| `fetchTopNews` mock API responses ilə test olunmayıb | 🔴 Yüksək |
| HTTP error status kodlarının handling-i test olunmayıb (403, 429, 500) | 🔴 Yüksək |
| API key olmadığı halda graceful fallback test olunmayıb | 🟡 Orta |
| `mapToNewsArticle` edge case-ləri test olunmayıb (missing fields) | 🟡 Orta |

---

## 9) TÖVSİYƏLƏR — PRİORİTETLƏNDİRİLMİŞ

### 🔴 Yüksək prioritet (stabilliyə təsir edir)

1. **GNews-specific error handling əlavə et**
   - 429 → retry with exponential backoff (1s, 2s, 4s)
   - 403 → log quota exhaustion, skip run gracefully, schedule next run gün sonrası
   - 401 → log auth failure, alert
   - 500/503 → retry with delay

2. **`fetchTopNews`-i `executeWithRetry` ilə wrap et**
   - `isRetryable` funksiyasını GNews statuslarına uyğunlaşdır
   - `retryDelayMs` 429 üçün response header-dən idarə et (varsa)

3. **`newsService.ts` üçün unit test yaz**
   - Mock `fetch` ilə hər status kodu üçün davranışı test et

### 🟡 Orta prioritet (keyfiyyəti artırır)

4. **Hardcoded parametrləri `.env`-ə köçür**
   - `GNEWS_LANG`, `GNEWS_COUNTRY`, `GNEWS_MAX_ARTICLES`

5. **Search endpoint inteqrasiyası əlavə et**
   - `fetchSearchNews(query)` funksiyası
   - Account niche keyword-lərindən query composite et
   - Top-headlines + Search nəticələrini merge et

6. **`from` parametri istifadə et**
   - Son 24-48 saatdakı xəbərləri API səviyyəsində filtrə
   - Client-side freshness scoring ehtiyacını azaldar

7. **`totalArticles` response field-ını logla**
   - Quota monitoring və article availability tracking üçün

### 🟢 Aşağı prioritet (optimization)

8. **İstifadə olunmayan GNews field-larını map et**
   - `id` — URL əvəzinə daha dəqiq dedupe key
   - `lang` — content language validation
   - `source.id` / `source.country` — source-level analytics

9. **`nullable=description,content` parametri əlavə et**
   - Article pool genişlənər, amma null handling-in düzgünlüyü əvvəlcə test olunmalıdır

10. **Content truncation warning əlavə et**
    - Free plan istifadə olunarsa, truncated content-i AI-a göndərməzdən əvvəl logla

---

## 10) XÜLASƏ

| Sahə | Status | Qeyd |
|---|---|---|
| Əsas inteqrasiya | ✅ İşləyir | Top-headlines + mapping + scoring |
| Error handling | 🔴 Zəif | Ümumi `throw`, status-specific davranış yoxdur |
| Rate/quota management | 🔴 Yoxdur | Throttling, quota tracking yoxdur |
| Retry policy uyğunluğu | 🔴 Yoxdur | GNews errors retry olunmur |
| Konfiqurasiya | 🟡 Qismən | Hardcoded lang/country/max |
| Search endpoint | ❌ İstifadə olunmur | Niche relevance artıra bilər |
| Test coverage | 🔴 Zəif | newsService.ts üçün test yoxdur |
| Data mapping | 🟡 Yaxşı | `id`, `lang`, `source.id` istifadə olunmur |
| Content quality | 🟡 Qismən | Free plan truncation warning yoxdur |

**Ümumi qiymətləndirmə:** GNews inteqrasiyası funksional olaraq işləyir, amma production-grade robustness üçün error handling, retry, və quota management əhəmiyyətli boşluqlarla etiraf olunur. Ən kritik risk: 429/403 xətalarının düzgün idarə olunmaması pipeline-ın birdən fail etməsinə və ya günlük quota-nın effektiv istifadə olunmamasına gətirib çıxarır.
