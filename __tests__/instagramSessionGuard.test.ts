import { describe, expect, it } from 'vitest';

import {
  assertInstagramSessionReady,
  type SessionValidationResult,
} from '../src/automation/instagramPublisher';

describe('assertInstagramSessionReady', () => {
  it('does not throw when validation is valid', () => {
    const validation: SessionValidationResult = {
      valid: true,
      expiresAt: '2026-12-31T00:00:00.000Z',
    };

    expect(() =>
      assertInstagramSessionReady(validation, 60 * 60 * 1000, 'storage.json')
    ).not.toThrow();
  });

  it('throws descriptive error when validation is invalid', () => {
    const validation: SessionValidationResult = {
      valid: false,
      reason: 'Session expires too soon (2026-04-12T12:00:00.000Z). Re-authentication is required.',
      expiresAt: '2026-04-12T12:00:00.000Z',
    };

    expect(() =>
      assertInstagramSessionReady(validation, 60 * 60 * 1000, 'storage.json')
    ).toThrow('Instagram session validation failed for storage.json');
  });
});
