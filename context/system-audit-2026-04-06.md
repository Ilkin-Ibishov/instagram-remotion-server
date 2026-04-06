# System Audit - 2026-04-06

Bu sənəd repo kodu əsasında hazırlanıb və sualların hamısına faktiki implementasiyaya görə cavab verir.

## 1) CORE SYSTEM

### Single source of truth nədir?

Qısa cavab: tək bir source of truth yoxdur, state parçalanıb.

- Schedule state (run gating) -> Postgres (`schedule_state` cədvəli)
- Distributed lock -> Redis (`SET NX EX`)
- Duplicate post history -> fayl (`post-history.json`)
- Session/auth state -> fayl (`storage.json`)
- Runtime logs -> fayl (`logs/run-*.log.json`) + console
- Render output -> fayl sistemi (`/tmp/renders`)

Evidence:
- `src/pipeline/scheduleState.ts` (DATABASE_URL, table, next_run_at)
- `src/pipeline/schedulerLock.ts` (REDIS_URL, NX/EX lock)
- `src/pipeline/postHistory.ts` (`post-history.json`)
- `src/automation/instagramPublisher.ts` (`storage.json`)
- `src/utils/logger.ts` (`./logs`)
- `server.ts` (`/tmp/renders`)

### DB? hansı?

- Postgres: scheduler state üçün (run zamanı qərar və run nəticələri)
- Redis: lock üçün
- Qalan kritik state DB-də deyil, fayllardadır.

### Post lifecycle necə track olunur?

Formal post lifecycle state-machine DB-də yoxdur.

Mövcud izləmə:
- Scheduler səviyyəsində: `schedule_state` cədvəlində `last_run_at`, `last_success_at`, `last_error_at`, `last_error_message`, `next_run_at`
- Content duplication səviyyəsində: `post-history.json` içində `articleUrl`, `postedAt`, `batchId`
- Render request səviyyəsində: `batchId` hər render çağırışında random yaradılır

Nəticə: post-by-post canonical lifecycle qeydi (pending -> rendered -> published) yoxdur.

### Status transition hard constraint-dir? (məs: rendered -> published only)

Xeyr. Kodda belə bir enforced transition yoxdur.

- `PipelineStatus` type var, amma real run path-da istifadə edilmir.
- `runPipeline` funksiyasında addımlar ardıcıldır (generate -> render -> publish), amma bu yalnız procedural flow-dur, persisted state transition deyil.

### Idempotency necə həll olunub?

Qismən və layer-specific:

- Scheduler endpoint idempotency/concurrency:
  - Redis distributed lock (`NX + EX`) eyni anda iki run-un qarşısını alır.
- Content dedupe:
  - `hasBeenPosted(article.url)` ilə artıq paylaşılmış URL-lər filtrdən çıxarılır.
- Render endpoint idempotency:
  - Yoxdur. Eyni payload 2 dəfə gəlsə 2 yeni render batch yaradılır.
- Publishing idempotency:
  - Güclü idempotency token/mekanizm yoxdur (Instagram publish əməliyyatı browser automation ilə edilir).

### Eyni input 2 dəfə gəlsə nə baş verir?

- `/api/render` üçün: hər dəfə yeni `batchId` yaradılır, yenidən render edir, yeni fayllar çıxır.
- Scheduler trigger üçün: lock varsa ikinci çağırış `skipped_lock_held` olur.
- Pipeline article selection üçün: eyni article URL əvvəl yazılıbsa (`post-history.json`) seçilməməlidir.

## 2) WORKFLOW / EXECUTION

### Worker-lar: ayrı process-dir, yoxsa eyni Node instance?

Ayrı worker process implementasiyası yoxdur. Scheduler route (`POST /api/schedule/run`) eyni Node/Express process içində `runScheduledPipeline()` çağırır.

### Horizontal scale etsən nə dəyişəcək?

- Müsbət:
  - Scheduler lock Redis-də olduğuna görə çox instansda eyni account üçün overlap riski azalır.
- Mənfi / risk:
  - `post-history.json`, `storage.json`, `logs`, `/tmp/renders` instance-local fayllardır.
  - Horizontal scale zamanı bu fayllar shared deyil (unless shared volume). Bu da dedupe və session consistency problemləri yarada bilər.

### Job pickup strategy nədir?

Queue/worker pickup sistemi yoxdur.

- Polling/pub-sub job queue yoxdur.
- Trigger modeli: external cron/webhook -> `POST /api/schedule/run`
- Endpoint özü `shouldRunNow` ilə due olub-olmadığını yoxlayır.

### Locking necədir?

- Redis key üzərində distributed lock:
  - `SET key token NX EX ttl`
- Release zamanı Lua script ilə token check edilərək silinir (ownership-safe unlock).

### Eyni job 2 worker tərəfindən götürülə bilərmi?

Normal halda: yox (eyni lock key üçün).

Guarantee mexanizmi:
- Scheduler run başlamazdan əvvəl `acquireDistributedLock` yoxlanır.
- Lock yoxdursa run `skipped_lock_held` qaytarır.
- `finally` blokunda release edilir.

Qalıq risklər:
- TTL bitməsi uzun run zamanı overlap yarada bilər (lease renew mexanizmi yoxdur).
- Lock key yalnız `accountId`-yə bağlıdır; job-level granular lock yoxdur.

## 3) FAILURE / RECOVERY

### Mid-process crash scenario

Render zamanı server öldüsə:

- `/api/render` üçün persistent status store yoxdur; request state itir.
- Webhook mode-da crash olarsa callback göndərilməyə bilər.
- Çıxmış partial fayllar `/tmp/renders` içində qala bilər.
- Scheduler route içində crash `recordRunFailure` yazmamışdan əvvəl olarsa schedule state-də dəqiq failure izi qalmaya bilər.

### Retry strategy

- `executeWithRetry` var.
- Default: `maxRetries = 1`, `retryDelayMs = 5000` (sabit delay).
- Retryable error heuristic message-based-dir (`timeout`, `network`, `chrome`, və s.).

Exponential backoff yoxdur.

### Max retry sonrası nə olur?

- Error throw olunur.
- `runScheduledPipeline` bunu tutub `recordRunFailure(...)` ilə failure yazır.
- Növbəti run üçün yeni `nextRunAt` hesablayır (random jitter min/max saat pəncərəsində).

### Poison job handling varmı?

Formal poison-queue / DLQ yoxdur.

- Həmişə fail edən səbəblər (məs: session expired) hər cron tick-də yenidən sınana bilər.
- Sistem tam bloklanmır, amma eyni failing səbəb təkrar olunur.

### Həmişə fail edən job sistemi bloklayır?

- Global sistem lock olub tam dayanma yoxdur.
- Amma eyni account üçün run-lar ardıcıl fail edə bilər.
- İrəliləmiş circuit breaker / cooldown escalation yoxdur.

## 4) RENDER LAYER

### Concurrency necə limitlənir?

- MP4 üçün `renderMedia` concurrency env ilə idarə olunur:
  - `RENDER_CONCURRENCY` (default `1`)
- Slide batch içində isə `Promise.all(renderPromises)` istifadə edilir, yəni slide-lar paralel start olur.

Nəticə:
- Kod içində həm per-render concurrency control var, həm də batch paralelliyi var.
- Default stabil rejim konservativdir (`1`).

### Static (4)? Dynamic (CPU-based)?

- Dinamik CPU-based auto-tuning yoxdur.
- Sadəcə env-driven static setting var (`RENDER_CONCURRENCY`).

### Memory pressure necə idarə olunur?

Mövcud tədbirlər:
- Concurrency default 1-ə salınıb
- `x264Preset: 'veryfast'`
- Chromium args: `--disable-dev-shm-usage`, `--no-sandbox`, `--disable-gpu`
- Periodik və post-render Chrome process cleanup (`setInterval` + finally cleanup)

Limitlər:
- Proactive memory monitor yoxdur.
- Queue-based backpressure yoxdur.

## 5) PUBLISHING

### Instagram layer: API / browser / hybrid?

Browser automation (Playwright) istifadə olunur. Rəsmi Instagram publishing API inteqrasiyası görünmür.

### Publish idempotency

Güclü publish idempotency mexanizmi yoxdur.

- Eyni media/caption ikinci dəfə də publish cəhd edilə bilər.
- Publish sonrası yalnız article URL history-yə yazılır; publish attempt dedupe key yoxdur.

### Account-level isolation varmı?

Qismən.

- Scheduler lock key `accountId` ilə namespace edilir.
- Amma pipeline account konfiqurasiyası global env-dən oxunur (`BRAND_*`).
- Multi-account üçün paralel, tam izolyasiyalı config/store modeli implement olunmayıb.

### Bir account ban olsa digərlərinə təsir edir?

Hazır implementasiyada əsasən bir account modeli var (single session file `storage.json`).

- Multi-account isolation güclü deyil.
- Əgər eyni deployment-də çox account düşünülürsə, shared env/session səbəbilə təsir riski yüksəkdir.

## 6) SCHEDULING

### Missed schedule problemi: system down idi -> post-lar nə olur?

Backfill mexanizmi yoxdur.

- Sistem qalxandan sonra ilk trigger-də yalnız `shouldRunNow` check edilir və bir run edilir.
- Miss edilmiş run-lar queue kimi toplanmır və ayrıca replay olunmur.

### Time drift / timezone handling varmı?

- `Date` və ISO timestamplar istifadə olunur.
- `TIMESTAMPTZ` Postgres-də saxlanır.
- Explicit timezone policy (məs. account-local timezone calendar scheduling) yoxdur.

## 7) CONTENT

### Duplicate detection necədir?

URL-based exact dedupe.

- `post-history.json` içində `articleUrl === article.url` müqayisəsi.
- Hash/semantic similarity yoxdur.

### Content quality gate varmı?

Qismən minimal gate var:

- Relevance score threshold (`MIN_RELEVANCE_SCORE`, default 10)
- Empty slide data üçün warning log

Amma:
- Strict schema validation gate (business-level) yoxdur.
- Human review gate yoxdur.
- "Gemini nə verirsə gedir" modelinə yaxın davranışdır, sadəcə bir neçə yumşaq check əlavə olunub.

## 8) OBSERVABILITY

### Real-time vəziyyəti görə bilirsən?

Qismən, manual.

- Structured log faylları var (`logs/run-*.log.json`)
- Scheduler state DB-də son run metadatası var

Amma real-time dashboard yoxdur:
- pending/failed/published live counters endpoint-i yoxdur.

### Alerting varmı? (fail rate > X%)

Yoxdur.

- Built-in alert manager, SLO, fail-rate monitor, notification pipeline görünmür.

## 9) FINAL STRESS TEST SCENARIO

Ssenari:
- 50 content gəldi
- 10 account var
- 20% render fail
- 10% publish fail

### Sistem stabil qalır?

Mövcud kodla bu ssenaridə "tam stabil" demək çətindir.

Niyə:
- Real queue/worker orchestration yoxdur (request-triggered icra)
- Multi-account state izolyasiyası zəifdir (env + storage.json + file-based history)
- Poison job/DLQ/circuit breaker yoxdur
- Observability/alerting zəifdir

Nə qədər davamlıdır:
- Scheduler lock eyni account üçün overlap riskini azaldır
- Retry policy transient xətaları qismən yumşaldır
- Render memory üçün konservativ parametrlər var

Praktik nəticə:
- Kiçik və orta həcmli, tək-account workload üçün işləkdir.
- Verilən stress ssenarisində architecture yenilənmədən operational risk yüksəkdir.

## 10) Risk Summary (qısa)

Yüksək risk:
- State parçalanması (DB + Redis + local files)
- Publish idempotency olmaması
- Multi-account isolation zəifliyi
- Alerting/dashboard olmaması

Orta risk:
- Retry sabit delay, exponential backoff yoxdur
- Lock TTL renewal yoxdur
- Missed-schedule backfill yoxdur

Aşağı risk / güclü tərəf:
- Scheduler lock implementasiyası düzgün əsaslarla yazılıb
- Schedule state persistent DB-dədir
- Render stability üçün praktiki mitigasiyalar əlavə olunub

## 11) Sənədləşdirmə qeydi

Bu audit yalnız repo-da görünən kod davranışına əsaslanır. Əlavə external infrastruktura (məs. ayrı queue service, external monitors) bu repoda olmadığı üçün hesabatda nəzərə alınmayıb.
