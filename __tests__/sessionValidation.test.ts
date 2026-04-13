import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { validateInstagramSessionExpiry } from '../src/automation/instagramPublisher';

const tempFiles: string[] = [];

function writeSessionFile(payload: unknown): string {
  const filePath = path.join(os.tmpdir(), `session-test-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
  tempFiles.push(filePath);
  return filePath;
}

afterEach(() => {
  for (const filePath of tempFiles.splice(0, tempFiles.length)) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

describe('validateInstagramSessionExpiry', () => {
  it('returns invalid when file is missing', () => {
    const result = validateInstagramSessionExpiry('missing-file.json');

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not found');
  });

  it('returns invalid when cookies are absent', () => {
    const sessionFile = writeSessionFile({ cookies: [] });
    const result = validateInstagramSessionExpiry(sessionFile);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('no cookies');
  });

  it('returns valid when expiry is sufficiently in the future', () => {
    const futureSeconds = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
    const sessionFile = writeSessionFile({
      cookies: [{ name: 'sessionid', expires: futureSeconds }],
    });

    const result = validateInstagramSessionExpiry(sessionFile, 60 * 60 * 1000);

    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBeTruthy();
  });

  it('returns invalid when expiry is too soon', () => {
    const nearFutureSeconds = Math.floor(Date.now() / 1000) + 10 * 60;
    const sessionFile = writeSessionFile({
      cookies: [{ name: 'sessionid', expires: nearFutureSeconds }],
    });

    const result = validateInstagramSessionExpiry(sessionFile, 60 * 60 * 1000);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expires too soon');
  });

  it('returns invalid when cookie expires exactly at minimum threshold boundary', () => {
    const minimumRemainingMs = 60 * 60 * 1000;
    const thresholdSeconds = Date.now() / 1000 + minimumRemainingMs / 1000;
    const sessionFile = writeSessionFile({
      cookies: [{ name: 'sessionid', expires: thresholdSeconds }],
    });

    const result = validateInstagramSessionExpiry(sessionFile, minimumRemainingMs);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expires too soon');
  });

  it('returns invalid when any critical cookie is expired even if others are valid', () => {
    const farFutureSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const expiredSeconds = Math.floor(Date.now() / 1000) - 1;
    const sessionFile = writeSessionFile({
      cookies: [
        { name: 'sessionid', expires: expiredSeconds },
        { name: 'csrftoken', expires: farFutureSeconds },
        { name: 'ds_user_id', expires: farFutureSeconds },
      ],
    });

    const result = validateInstagramSessionExpiry(sessionFile, 60 * 60 * 1000);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expires too soon');
  });

  it('returns valid when all critical cookies have sufficient remaining time', () => {
    const farFutureSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const sessionFile = writeSessionFile({
      cookies: [
        { name: 'sessionid', expires: farFutureSeconds },
        { name: 'csrftoken', expires: farFutureSeconds },
        { name: 'ds_user_id', expires: farFutureSeconds },
      ],
    });

    const result = validateInstagramSessionExpiry(sessionFile, 60 * 60 * 1000);

    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBeTruthy();
  });
});
