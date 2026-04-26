import 'dotenv/config';
import {
  getRecentPublishedPosts,
  getPostEvents,
  getPostQualityScore,
  getPostEngagementSnapshots,
} from '../src/pipeline/publishedPostStore';

function parseArgs(argv: string[]): { limit: number; days: number } {
  let limit = 10;
  let days = 7;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--limit' && argv[i + 1]) {
      limit = Math.max(1, Math.min(100, Number(argv[i + 1]) || limit));
      i += 1;
    } else if (argv[i] === '--days' && argv[i + 1]) {
      days = Math.max(1, Math.min(365, Number(argv[i + 1]) || days));
      i += 1;
    }
  }

  return { limit, days };
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

const { limit, days } = parseArgs(process.argv.slice(2));
const rows = await getRecentPublishedPosts(limit, days);

console.log(`# Published posts report (${days}d, limit ${limit})`);
console.log('');
console.log(`Total rows: ${rows.length}`);

const statusCounts = new Map<string, number>();
const sourceCounts = new Map<string, number>();
const templateCounts = new Map<string, number>();
const topicCounts = new Map<string, number>();

for (const row of rows) {
  statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  sourceCounts.set(domainFromUrl(row.article_url), (sourceCounts.get(domainFromUrl(row.article_url)) ?? 0) + 1);
  for (const templateId of row.template_sequence ?? []) {
    templateCounts.set(templateId, (templateCounts.get(templateId) ?? 0) + 1);
  }
  if (row.topic_fingerprint) {
    topicCounts.set(row.topic_fingerprint, (topicCounts.get(row.topic_fingerprint) ?? 0) + 1);
  }
}

function printCounts(title: string, counts: Map<string, number>): void {
  console.log('');
  console.log(`## ${title}`);
  if (counts.size === 0) {
    console.log('- none');
    return;
  }
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([key, count]) => console.log(`- ${key}: ${count}`));
}

printCounts('Statuses', statusCounts);
printCounts('Sources', sourceCounts);
printCounts('Template usage', templateCounts);
printCounts('Repeated topic fingerprints', new Map([...topicCounts].filter(([, count]) => count > 1)));

console.log('');
console.log('## Recent posts');

for (const row of rows) {
  const quality = await getPostQualityScore(row.id);
  const events = await getPostEvents(row.id);
  const engagement = await getPostEngagementSnapshots(row.id, 1);
  console.log('');
  console.log(`### ${row.article_title}`);
  console.log(`- Status: ${row.status}`);
  console.log(`- Published: ${row.published_at ?? 'not published'}`);
  console.log(`- Source: ${row.article_url}`);
  console.log(`- Instagram: ${row.instagram_permalink ?? 'not captured'}`);
  console.log(`- Templates: ${(row.template_sequence ?? []).join(' -> ') || 'not generated'}`);
  console.log(`- Caption length: ${quality?.caption_length ?? 'n/a'}`);
  console.log(`- Hashtags: ${quality?.hashtag_count ?? 'n/a'}`);
  console.log(`- Quality score: ${quality?.content_quality_score ?? 'n/a'}`);
  console.log(`- Events: ${events.map((event) => event.event_type).join(', ') || 'none'}`);
  if (engagement[0]) {
    console.log(`- Latest engagement snapshot: ${engagement[0].captured_at}`);
  }
}
