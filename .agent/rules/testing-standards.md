---
description: Standards for testing in __tests__ using Vitest and Supertest
globs: "__tests__/*.test.ts"
---

# Testing Standards

Maintain a high level of confidence in the API and rendering logic by following these testing standards.

## Frameworks

- **Runner**: Vitest
- **API Testing**: Supertest

## Writing Tests

1. **Port Binding**: **NEVER** let tests bind to the production port (3000). 
   - Code in `server.ts` should check `process.env.NODE_ENV === 'test'` or `process.env.VITEST` to skip `startServer()`.
   - In tests, import `app` and pass it to `request(app)`.
2. **Mocking**: Mock heavy operations like `renderStill` or `renderMedia` if you are only testing API routing and validation. Full render tests should be isolated or run as a separate suite.
3. **New Features**: Every new API parameter or endpoint **must** have a corresponding test case in `__tests__/server.test.ts`.
4. **Startup Bootstrap Paths**: When changing startup helpers in `server.ts` such as `bootstrapInstagramSession()`, add direct tests for the new normalization/validation behavior rather than relying only on end-to-end scheduler or Playwright failures.

## Execution

- Use `npm test` or `npx vitest` to run tests.
- Ensure that `RENDER_DIR` is cleaned up or pointed to a temp test directory during test runs.

## Example Reference
- See `__tests__/server.test.ts` for reference implementations of API tests.
