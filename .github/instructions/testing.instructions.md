---
description: Testing standards for the instagram-content-generator project using Vitest and Supertest
applyTo: "__tests__/**/*.test.ts,__tests__/**/*.spec.ts"
---

# Testing Standards

Maintain high confidence in the API and rendering logic by following these testing standards and best practices.

## Testing Frameworks

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (fast, Vite-native) |
| **Supertest** | HTTP assertion library for testing Express endpoints |
| **vi** | Vitest mock utilities |

## Project Structure

```
__tests__/
├── server.test.ts       # Main API endpoint tests
├── components.test.ts   # React component tests (if needed)
└── integration/         # Full render tests (optional, slow)
```

## Core Testing Rules

### 1. Production Port Safety
**CRITICAL**: Tests must **never** bind to port 3000 (production port).

**In `server.ts`:**
```typescript
// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}

export default app;  // Export for test imports
```

**In `__tests__/server.test.ts`:**
```typescript
import request from 'supertest';
import app from '../server'; // Import the Express app, don't start a server

// Test endpoint without starting a server
request(app)
  .post('/api/render')
  .send({ /* payload */ })
  .expect(200);
```

### 2. Test Structure
Use standard Vitest + Supertest patterns:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server';

describe('POST /api/render', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should return 400 if globalBranding is missing', async () => {
    const response = await request(app)
      .post('/api/render')
      .send({
        carousel: [{ templateId: 'HOOK_A', data: {} }],
        // Missing globalBranding
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('globalBranding');
  });

  it('should return 200 with render URLs on success', async () => {
    const validPayload = {
      globalBranding: {
        accentColor: '#FF5733',
        handle: '@test',
        effects: [],
      },
      carousel: [
        { templateId: 'HOOK_A', data: { headline: 'Test' } },
      ],
      format: 'png',
    };

    const response = await request(app)
      .post('/api/render')
      .send(validPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.images).toBeInstanceOf(Array);
    expect(response.body.images[0]).toMatch(/^\/api\/renders\//);
  });
});
```

### 3. Mocking Heavy Operations

Mock Remotion rendering functions to avoid slow full renders in unit tests:

```typescript
import { vi } from 'vitest';

// Mock Remotion bundler
vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('/tmp/cache/bundle.zip'),
  ensureBundle: vi.fn().mockResolvedValue('/tmp/cache/bundle.zip'),
}));

// Mock Remotion renderer
vi.mock('@remotion/renderer', () => ({
  renderStill: vi.fn().mockResolvedValue(),
  renderMedia: vi.fn().mockResolvedValue(),
}));
```

**When to mock:**
- Testing **routing & validation** → Mock render functions
- Testing **error handling** → Mock to trigger specific errors
- Testing **full render pipeline** → Use integration tests instead

**When NOT to mock:**
- Integration / end-to-end tests (separate suite)
- Performance benchmarks
- Final validation before deployment

### 4. Async Rendering Tests

If testing webhook-based async mode:

```typescript
it('should return 202 and queue async render when webhookUrl is provided', async () => {
  const response = await request(app)
    .post('/api/render')
    .send({
      ...validPayload,
      webhookUrl: 'https://webhook.example.com/render-done',
    });

  expect(response.status).toBe(202);
  expect(response.body.batchId).toBeTruthy();

  // Verify webhook will be called (optional: mock http.post)
});
```

## New Features: Testing Requirements

**Every new API parameter or endpoint must have corresponding test cases.**

When startup helpers in `server.ts` change, add focused tests for those helpers in `__tests__/server.test.ts` rather than relying on scheduler or Playwright failures to expose regressions.

### Checklist for New Features

- [ ] Unit test for valid input
- [ ] Unit test for missing required fields (400 error)
- [ ] Unit test for invalid field values (400 error)
- [ ] Integration test (if endpoint behavior depends on complex logic)
- [ ] Error handling test (500, 503, etc.)
- [ ] Documentation in `context/api-server.md`
- [ ] For `bootstrapInstagramSession()` changes, direct coverage for encoding/normalization paths (for example UTF-8 vs UTF-16LE base64 session payloads)

Example: Adding a `quality` parameter to `/api/render`

```typescript
describe('quality parameter', () => {
  it('should accept quality: "high", "medium", "low"', async () => {
    const response = await request(app)
      .post('/api/render')
      .send({ ...validPayload, quality: 'high' });

    expect(response.status).toBe(200);
  });

  it('should return 400 if quality is invalid', async () => {
    const response = await request(app)
      .post('/api/render')
      .send({ ...validPayload, quality: 'ultra' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('quality');
  });
});
```

## Environment Variables in Tests

### RENDER_DIR
Current server implementation uses a fixed render directory (`/tmp/renders`).
If render path configurability is introduced later, add test coverage for env-driven path handling.

### NODE_ENV
Set to 'test' to skip server startup:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
    },
  },
});
```

## Running Tests

### All Tests
```bash
npm test
# or
npx vitest
```

### Watch Mode
```bash
npm test -- --watch
```

### Specific Test File
```bash
npm test -- server.test.ts
```

### Coverage Report
```bash
npm test -- --coverage
```

## Test File Organization

```typescript
// __tests__/server.test.ts

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server';

// Setup
beforeAll(() => {
  process.env.RENDER_DIR = '/tmp/test-renders';
});

afterAll(() => {
  // Cleanup resources
  vi.restoreAllMocks();
});

// Grouped test suites
describe('POST /api/render', () => {
  describe('validation', () => {
    it('should validate required fields', () => { /* ... */ });
  });

  describe('success cases', () => {
    it('should render PNG slides', () => { /* ... */ });
    it('should render MP4 video', () => { /* ... */ });
  });

  describe('async rendering', () => {
    it('should queue webhook when provided', () => { /* ... */ });
  });

  describe('error handling', () => {
    it('should return 500 on bundle failure', () => { /* ... */ });
  });
});
```

## Mocking Database or Services (if applicable)

If adding authorization, rate limiting, or external service calls:

```typescript
vi.mock('../src/pipeline/aiService', () => ({
  generatePostContentAI: vi.fn().mockResolvedValue({
    manifest: { /* mock data */ },
  }),
}));
```

## Common Test Patterns

### Testing Sync Endpoints
```typescript
it('returns result immediately', async () => {
  const start = Date.now();
  const response = await request(app)
    .post('/api/render')
    .send(payload);
  const elapsed = Date.now() - start;

  expect(response.status).toBe(200);
  expect(response.body.images).toBeDefined();
  expect(elapsed).toBeLessThan(5000); // Should be < 5s (mocked)
});
```

### Testing Error Conditions
```typescript
it('catches and returns errors on render failure', async () => {
  const mockRender = vi.spyOn(renderer, 'renderStill');
  mockRender.mockRejectedValueOnce(new Error('Chrome crashed'));

  const response = await request(app)
    .post('/api/render')
    .send(payload);

  expect(response.status).toBe(500);
  expect(response.body.error).toContain('render');
});
```

### Testing File Output
```typescript
it('creates render files in RENDER_DIR', async () => {
  const response = await request(app)
    .post('/api/render')
    .send(payload);

  // Check if files exist
  const files = fs.readdirSync(process.env.RENDER_DIR!);
  expect(files.length).toBeGreaterThan(0);
  expect(files[0]).toMatch(/^render-.*\.png$/);
});
```

## Debugging Failed Tests

### Print Debug Info
```typescript
it('should render', async () => {
  const response = await request(app)
    .post('/api/render')
    .send(payload);

  if (response.status !== 200) {
    console.log('Response body:', response.body);
    console.log('Response status:', response.status);
  }

  expect(response.status).toBe(200);
});
```

### Run with Verbose Output
```bash
npx vitest run --reporter=verbose
```

### Run Single Test
```bash
npx vitest run -t "should return 400 if globalBranding is missing"
```

## CI/CD Integration

In your CI pipeline (GitHub Actions, GitLab CI, etc.):

```yaml
test:
  script:
    - npm ci
    - npm test -- --run  # Run once and exit
  coverage: '/Lines\s+:\s+(\d+\.?\d*)%/'
```

## Performance & Timeouts

Set appropriate timeouts for different test types:

```typescript
describe('POST /api/render', () => {
  // Fast unit tests: 2s timeout
  it('validates input', async () => { /* ... */ }, { timeout: 2000 });

  // Mocked integration tests: 5s timeout
  it('renders slides', async () => { /* ... */ }, { timeout: 5000 });

  // Full render tests (separate suite): 60s+ timeout
  // it.skip('full render', async () => { /* ... */ }, { timeout: 60000 });
});
```

## Reference Example

See `__tests__/server.test.ts` for a complete reference implementation of API tests using Vitest + Supertest.
