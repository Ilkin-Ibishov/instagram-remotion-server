import { describe, it, expect } from 'vitest';
import { normalizeArticleUrl } from '../src/utils/normalizeUrl';

describe('normalizeArticleUrl', () => {
  it('returns the same URL for an already normalised URL', () => {
    const url = 'https://bbc.com/news/article-123';
    expect(normalizeArticleUrl(url)).toBe(url);
  });

  it('converts http to https', () => {
    expect(normalizeArticleUrl('http://example.com/article'))
      .toBe('https://example.com/article');
  });

  it('strips www. subdomain', () => {
    expect(normalizeArticleUrl('https://www.reuters.com/world/story'))
      .toBe('https://reuters.com/world/story');
  });

  it('removes trailing slash', () => {
    expect(normalizeArticleUrl('https://example.com/story/'))
      .toBe('https://example.com/story');
  });

  it('removes UTM tracking params', () => {
    const dirty = 'https://example.com/article?utm_source=twitter&utm_campaign=news&id=42';
    expect(normalizeArticleUrl(dirty)).toBe('https://example.com/article?id=42');
  });

  it('removes fragment', () => {
    expect(normalizeArticleUrl('https://example.com/article#comments'))
      .toBe('https://example.com/article');
  });

  it('lowercases scheme and host (full URL is lowercased)', () => {
    // The implementation lowercases the entire raw URL before URL parsing,
    // so path casing is also normalised to lowercase.
    expect(normalizeArticleUrl('HTTP://Example.COM/Article'))
      .toBe('https://example.com/article');
  });

  it('deduplicates www vs non-www', () => {
    const a = normalizeArticleUrl('https://www.bbc.com/news/story');
    const b = normalizeArticleUrl('https://bbc.com/news/story');
    expect(a).toBe(b);
  });

  it('deduplicates http vs https', () => {
    const a = normalizeArticleUrl('http://cnn.com/article');
    const b = normalizeArticleUrl('https://cnn.com/article');
    expect(a).toBe(b);
  });

  it('returns original string for invalid URLs', () => {
    expect(normalizeArticleUrl('not-a-url')).toBe('not-a-url');
  });

  it('handles empty string gracefully', () => {
    expect(normalizeArticleUrl('')).toBe('');
  });

  it('preserves non-tracking query params', () => {
    const url = 'https://example.com/search?q=ai&page=2';
    expect(normalizeArticleUrl(url)).toBe(url);
  });

  it('removes all known tracking params at once', () => {
    const dirty =
      'https://example.com/article?fbclid=abc&gclid=xyz&utm_content=test&ref=email';
    expect(normalizeArticleUrl(dirty)).toBe('https://example.com/article');
  });
});
