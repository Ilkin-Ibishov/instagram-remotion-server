export interface RssSource {
  id: string;
  name: string;
  feedUrl: string;
  niches: string[];
  cacheTtlSeconds: number;
  enabled: boolean;
}

export const RSS_SOURCES: RssSource[] = [
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    feedUrl: 'https://techcrunch.com/feed/',
    niches: ['technology', 'startup', 'business'],
    cacheTtlSeconds: 900,
    enabled: true,
  },
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    feedUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    niches: ['technology', 'science', 'development'],
    cacheTtlSeconds: 1800,
    enabled: true,
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    feedUrl: 'https://www.theverge.com/rss/index.xml',
    niches: ['technology', 'consumer-tech'],
    cacheTtlSeconds: 900,
    enabled: true,
  },
  {
    id: 'wired-ai',
    name: 'Wired AI',
    feedUrl: 'https://www.wired.com/feed/tag/ai/latest/rss',
    niches: ['technology', 'ai'],
    cacheTtlSeconds: 1800,
    enabled: true,
  },
  {
    id: 'guardian-tech',
    name: 'The Guardian Technology',
    feedUrl: 'https://www.theguardian.com/technology/rss',
    niches: ['technology', 'business'],
    cacheTtlSeconds: 1800,
    enabled: true,
  },
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    feedUrl: 'https://www.technologyreview.com/feed/',
    niches: ['technology', 'ai', 'science'],
    cacheTtlSeconds: 3600,
    enabled: true,
  },
];

export function getSourcesForNiche(niches: string[]): RssSource[] {
  const activeSources = RSS_SOURCES.filter((source) => source.enabled);
  if (!niches.length) {
    return activeSources;
  }

  const nicheSet = new Set(niches.map((niche) => niche.toLowerCase()));
  const matched = activeSources.filter((source) => source.niches.some((niche) => nicheSet.has(niche.toLowerCase())));
  return matched.length > 0 ? matched : activeSources;
}
