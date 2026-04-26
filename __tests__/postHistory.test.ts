import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isArticlePostedInHistory } from '../src/pipeline/postHistory';

describe('postHistory corruption handling', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    delete process.env.POST_HISTORY_PATH;
    delete process.env.POST_HISTORY_STORE;
    delete process.env.DATABASE_URL;
    vi.resetModules();

    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('does not overwrite a corrupted history file when recording a post', async () => {
    vi.resetModules();

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'post-history-corrupt-'));
    tempDirs.push(tempDir);

    const historyPath = path.join(tempDir, 'post-history.json');
    fs.writeFileSync(historyPath, '{ this is not valid json');
    process.env.POST_HISTORY_PATH = historyPath;

    const loggerModule = await import('../src/utils/logger');
    const errorSpy = vi.spyOn(loggerModule.Logger.prototype, 'error').mockImplementation(() => undefined);

    const mod = await import('../src/pipeline/postHistory');
    await mod.recordPost(
      {
        title: 'New article',
        url: 'https://example.com/new-article',
      },
      'batch-1'
    );

    expect(fs.readFileSync(historyPath, 'utf8')).toBe('{ this is not valid json');
    expect(errorSpy).toHaveBeenCalledWith(
      'history',
      'Refusing to overwrite corrupted post history. Fix or replace the history file before recording new posts.'
    );
  });
});

describe('isArticlePostedInHistory', () => {
  it('detects duplicate URL after normalization', () => {
    const posted: Parameters<typeof isArticlePostedInHistory>[0] = [
      {
        articleTitle: 'Story',
        articleUrl: 'https://example.com/path/',
        postedAt: '2026-04-01T00:00:00.000Z',
        batchId: 'b',
      },
    ];
    expect(isArticlePostedInHistory(posted, 'https://example.com/path')).toBe(true);
  });

  it('detects same story with different URL when title fingerprint matches', async () => {
    const { createTitleFingerprint } = await import('../src/utils/titleFingerprint');
    const title = 'Breaking: major platform outage resolved';
    const posted: Parameters<typeof isArticlePostedInHistory>[0] = [
      {
        articleTitle: title,
        articleUrl: 'https://example.com/a',
        titleFingerprint: createTitleFingerprint(title),
        postedAt: '2026-04-01T00:00:00.000Z',
        batchId: 'b',
      },
    ];

    const syndicatedTitle = 'Breaking: Major platform outage resolved';
    expect(isArticlePostedInHistory(posted, 'https://other.example/b', syndicatedTitle)).toBe(true);
  });
});