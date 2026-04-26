import { describe, expect, it } from 'vitest';

import {
  findNewPublishedPermalink,
  __testing as instagramTesting,
  resolveInstagramUsername,
} from '../src/automation/instagramPublisher';

describe('resolveInstagramUsername', () => {
  it('normalizes a handle with @ prefix', () => {
    expect(resolveInstagramUsername('@theinitial.dev')).toBe('theinitial.dev');
  });

  it('normalizes a full instagram profile URL', () => {
    expect(resolveInstagramUsername('https://www.instagram.com/theinitial.dev/')).toBe('theinitial.dev');
  });

  it('returns null for invalid values', () => {
    expect(resolveInstagramUsername(undefined)).toBeNull();
    expect(resolveInstagramUsername('')).toBeNull();
    expect(resolveInstagramUsername('@bad handle')).toBeNull();
  });
});

describe('findNewPublishedPermalink', () => {
  it('returns the first permalink not present in baseline', () => {
    const baseline = ['/p/old-1/', '/p/old-2/'];
    const current = ['/p/new-3/', '/p/old-1/', '/p/old-2/'];

    expect(findNewPublishedPermalink(baseline, current)).toBe('/p/new-3/');
  });

  it('returns null when there is no new permalink', () => {
    const baseline = ['/p/old-1/', '/reel/old-2/'];
    const current = ['/reel/old-2/', '/p/old-1/'];

    expect(findNewPublishedPermalink(baseline, current)).toBeNull();
  });
});

describe('instagram publish result helpers', () => {
  it('creates a verified permalink result', () => {
    const result = instagramTesting.createPublishResult({
      confirmed: true,
      permalink: '/p/new-3/',
      verificationMethod: 'profile_permalink',
      baselinePermalinkCount: 2,
      publishDurationMs: 1234,
    });

    expect(result).toEqual({
      confirmed: true,
      permalink: '/p/new-3/',
      verificationMethod: 'profile_permalink',
      baselinePermalinkCount: 2,
      publishDurationMs: 1234,
    });
  });
});
