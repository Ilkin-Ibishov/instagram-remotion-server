import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/automation/instagramPublisher', () => ({
  publishToInstagram: vi.fn().mockResolvedValue({
    confirmed: true,
    permalink: 'https://www.instagram.com/p/test-post/',
    verificationMethod: 'profile_permalink',
    publishDurationMs: 1234,
  }),
}));

vi.mock('../src/render/renderService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/render/renderService')>();
  return {
    ...actual,
    renderManifest: vi.fn().mockResolvedValue({
      images: ['/api/renders/render-test-0.png', '/api/renders/render-test-1.png', '/api/renders/render-test-2.png'],
      batchId: 'render-test',
    }),
  };
});

vi.mock('../src/pipeline/aiService', () => ({
  generatePostContentAI: vi.fn(),
}));

const publishedPostStoreMocks = vi.hoisted(() => ({
  buildPublishedPostContext: vi.fn((batchId: string) => ({
    batchId,
    accountId: 'default',
    contentIntent: 'balanced',
    pipelineVersion: 'test',
    modelName: 'gemini-2.5-flash',
    sourceStrategy: 'gnews',
    selectionStrategy: 'diverse',
    renderFormat: 'png',
  })),
  recordSelectedPost: vi.fn().mockResolvedValue(undefined),
  recordGeneratedPost: vi.fn().mockResolvedValue(undefined),
  recordRenderedPost: vi.fn().mockResolvedValue(undefined),
  recordPublishStartedPost: vi.fn().mockResolvedValue(undefined),
  recordPublishedPost: vi.fn().mockResolvedValue(undefined),
  recordFailedPost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/pipeline/publishedPostStore', () => publishedPostStoreMocks);

import { publishToInstagram } from '../src/automation/instagramPublisher';
import { generatePostContentAI } from '../src/pipeline/aiService';
import { renderManifest } from '../src/render/renderService';

const mockedGeneratePostContentAI = vi.mocked(generatePostContentAI);
const mockedPublishToInstagram = vi.mocked(publishToInstagram);
const mockedRenderManifest = vi.mocked(renderManifest);

describe('runPipelineWithResult integration path', () => {
  let historyDir: string;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-run-history-'));
    process.env.POST_HISTORY_PATH = path.join(historyDir, 'post-history.json');
    process.env.POST_HISTORY_STORE = 'file';
    process.env.USE_RSS_FEEDS = 'false';
    process.env.GNEWS_API_KEY = 'test-gnews-key';
    process.env.GNEWS_LANG = 'en';
    process.env.GNEWS_COUNTRY = 'us';
    process.env.GNEWS_MAX_ARTICLES = '10';
    process.env.MIN_RELEVANCE_SCORE = '10';
    process.env.RENDER_FORMAT = 'png';
    process.env.BRAND_HANDLE = '@testdev';
    process.env.BRAND_DISPLAY_NAME = 'Test Dev';
    process.env.BRAND_BIO = 'Developer tools and startup automation';
    process.env.BRAND_NICHE = 'technology,startup,developer';
    process.env.BRAND_ACCENT_COLOR = '#3b82f6';
    process.env.BRAND_EFFECTS = 'vignette';

    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        articles: [
          {
            id: 'gnews-happy-1',
            title: 'Startup launches developer automation platform',
            description: 'A technology startup launched a developer automation platform for engineering teams.',
            content: 'A technology startup launched a developer automation platform for engineering teams.',
            url: 'https://example.com/startup-automation-platform',
            image: 'https://example.com/automation.jpg',
            publishedAt: '2026-04-08T00:00:00Z',
            source: { name: 'Example News' },
          },
        ],
      }),
      text: vi.fn().mockResolvedValue(''),
    } as any);

    mockedGeneratePostContentAI.mockResolvedValue({
      manifest: {
        format: 'instagram_carousel',
        globalBranding: { accentColor: '#3b82f6', handle: '@testdev', effects: ['vignette'] },
        carousel: [
          { templateId: 'HOOK_A', data: { headline: 'Developer work just shifted', subheadline: 'A startup is automating the boring parts', imageUrl: 'https://example.com/automation.jpg' } },
          { templateId: 'CONTENT_LISTICLE', data: { title: 'What changed', items: ['Less manual setup', 'Faster internal tools', 'More automation', 'Higher developer leverage'], footnote: 'Based on the launch details' } },
          { templateId: 'CTA_FINAL', data: { callToAction: 'Would you use this?', subtext: 'Tell us where automation helps most' } },
        ],
      },
      caption: 'Developer work is changing fast.\n\nAutomation is moving into the boring setup work.\n\nTeams may ship internal tools faster now.',
      hashtags: '#developers #automation #startup',
    } as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    fs.rmSync(historyDir, { recursive: true, force: true });
    delete process.env.POST_HISTORY_PATH;
    delete process.env.POST_HISTORY_STORE;
    delete process.env.USE_RSS_FEEDS;
    delete process.env.GNEWS_API_KEY;
    delete process.env.GNEWS_LANG;
    delete process.env.GNEWS_COUNTRY;
    delete process.env.GNEWS_MAX_ARTICLES;
    delete process.env.MIN_RELEVANCE_SCORE;
    delete process.env.RENDER_FORMAT;
    delete process.env.BRAND_HANDLE;
    delete process.env.BRAND_DISPLAY_NAME;
    delete process.env.BRAND_BIO;
    delete process.env.BRAND_NICHE;
    delete process.env.BRAND_ACCENT_COLOR;
    delete process.env.BRAND_EFFECTS;
  });

  it('completes full pipeline and exposes produced result data', async () => {
    const { runPipelineWithResult } = await import('../src/pipelineRun');
    const { getRecentPosts } = await import('../src/pipeline/postHistory');

    const result = await runPipelineWithResult();

    expect(result.status).toBe('published');
    expect(result.article.articleId).toBe('gnews-happy-1');
    expect(result.article.url).toBe('https://example.com/startup-automation-platform');
    expect(result.content.manifest.carousel.map((slide) => slide.templateId)).toEqual([
      'HOOK_A',
      'CONTENT_LISTICLE',
      'CTA_FINAL',
    ]);
    expect(result.mediaPaths).toEqual([
      '/tmp/renders/render-test-0.png',
      '/tmp/renders/render-test-1.png',
      '/tmp/renders/render-test-2.png',
    ]);
    expect(result.post.caption).toContain('Developer work is changing fast.');
    expect(result.post.isCarousel).toBe(true);
    expect(result.publishResult.permalink).toBe('https://www.instagram.com/p/test-post/');

    const history = await getRecentPosts(30);
    expect(history).toHaveLength(1);
    expect(history[0].articleId).toBe('gnews-happy-1');
    expect(history[0].articleUrl).toBe('https://example.com/startup-automation-platform');

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(mockedGeneratePostContentAI).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: 'gnews-happy-1' }),
      expect.objectContaining({ handle: '@testdev' }),
      undefined
    );
    expect(mockedRenderManifest).toHaveBeenCalledOnce();
    expect(mockedPublishToInstagram).toHaveBeenCalledWith(result.post, undefined);
    expect(publishedPostStoreMocks.recordSelectedPost).toHaveBeenCalledOnce();
    expect(publishedPostStoreMocks.recordGeneratedPost).toHaveBeenCalledOnce();
    expect(publishedPostStoreMocks.recordRenderedPost).toHaveBeenCalledOnce();
    expect(publishedPostStoreMocks.recordPublishedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: expect.stringMatching(/^batch-/),
      }),
      expect.objectContaining({
        permalink: 'https://www.instagram.com/p/test-post/',
      })
    );
    expect(publishedPostStoreMocks.recordFailedPost).not.toHaveBeenCalled();
  });
});
