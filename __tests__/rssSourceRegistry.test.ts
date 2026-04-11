import { describe, expect, it } from 'vitest';

import { RSS_SOURCES, getSourcesForNiche } from '../src/pipeline/rssSourceRegistry';

describe('rssSourceRegistry', () => {
  it('returns all enabled sources when niche list is empty', () => {
    const result = getSourcesForNiche([]);
    const enabledCount = RSS_SOURCES.filter((source) => source.enabled).length;

    expect(result).toHaveLength(enabledCount);
    expect(result.every((source) => source.enabled)).toBe(true);
  });

  it('returns niche-matched sources when there is a match', () => {
    const result = getSourcesForNiche(['ai']);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((source) => source.niches.includes('ai'))).toBe(true);
  });

  it('falls back to all enabled sources when niche has no match', () => {
    const result = getSourcesForNiche(['nonexistent-niche']);
    const enabledCount = RSS_SOURCES.filter((source) => source.enabled).length;

    expect(result).toHaveLength(enabledCount);
  });

  it('matches niche case-insensitively', () => {
    const lower = getSourcesForNiche(['technology']);
    const mixed = getSourcesForNiche(['TeChNoLoGy']);

    expect(mixed.map((source) => source.id)).toEqual(lower.map((source) => source.id));
  });
});
