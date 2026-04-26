import { describe, expect, it } from 'vitest';

import { isInstagramAuthenticated, type InstagramAuthSignals } from '../src/automation/instagramPublisher';

function makeSignals(overrides: Partial<InstagramAuthSignals> = {}): InstagramAuthSignals {
  return {
    hasUsernameInput: false,
    hasPasswordInput: false,
    hasFeedNav: true,
    hasCreateTrigger: true,
    ...overrides,
  };
}

describe('isInstagramAuthenticated', () => {
  it('returns true when login form is absent and authenticated UI is present', () => {
    expect(isInstagramAuthenticated(makeSignals())).toBe(true);
  });

  it('returns false when login form fields are present', () => {
    expect(isInstagramAuthenticated(makeSignals({ hasUsernameInput: true }))).toBe(false);
    expect(isInstagramAuthenticated(makeSignals({ hasPasswordInput: true }))).toBe(false);
  });

  it('returns false when neither create trigger nor nav is visible', () => {
    expect(
      isInstagramAuthenticated(makeSignals({ hasFeedNav: false, hasCreateTrigger: false }))
    ).toBe(false);
  });
});
