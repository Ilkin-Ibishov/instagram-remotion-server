import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAccountProfile } from '../src/pipeline/accountProfile';

afterEach(() => {
  delete process.env.BRAND_HANDLE;
  delete process.env.BRAND_DISPLAY_NAME;
  delete process.env.BRAND_BIO;
  delete process.env.BRAND_NICHE;
  delete process.env.BRAND_ACCENT_COLOR;
  delete process.env.BRAND_EFFECTS;
  vi.restoreAllMocks();
});

describe('loadAccountProfile', () => {
  it('throws when BRAND_NICHE has no non-empty values', () => {
    process.env.BRAND_NICHE = ',,   ,';

    expect(() => loadAccountProfile()).toThrow('BRAND_NICHE must contain at least one non-empty value');
  });

  it('filters unknown effects and keeps allowed values', () => {
    process.env.BRAND_NICHE = 'technology';
    process.env.BRAND_EFFECTS = 'vignette,unknown_effect,crt';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const profile = loadAccountProfile();

    expect(profile.effects).toEqual(['vignette', 'crt']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns empty effects when all effect values are invalid', () => {
    process.env.BRAND_NICHE = 'technology';
    process.env.BRAND_EFFECTS = 'foo,bar';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const profile = loadAccountProfile();

    expect(profile.effects).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
