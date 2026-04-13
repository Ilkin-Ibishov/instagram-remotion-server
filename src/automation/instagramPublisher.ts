import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { Page } from 'playwright';
import type { PublishablePost } from '../pipeline/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  expiresAt?: string | null;
}

const CRITICAL_INSTAGRAM_COOKIES = new Set(['sessionid', 'csrftoken', 'ds_user_id']);
const INSTAGRAM_CAPTION_LIMIT = 2200;
const INSTAGRAM_HASHTAG_LIMIT = 30;

async function dismissReelInfoModalIfPresent(
  page: Page,
  contextLabel: string,
  timeoutMs: number = 3000
): Promise<boolean> {
  const okButton = page.getByRole('button', { name: 'OK', exact: true }).first();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const visible = await okButton.isVisible({ timeout: 600 }).catch(() => false);
    if (visible) {
      console.log(`[instagram] Dismissing delayed Reels modal (${contextLabel})...`);
      await okButton.click({ force: true });
      await delay(500);
      return true;
    }
    await delay(200);
  }

  return false;
}

export interface InstagramAuthSignals {
  hasUsernameInput: boolean;
  hasPasswordInput: boolean;
  hasFeedNav: boolean;
  hasCreateTrigger: boolean;
}

export function isInstagramAuthenticated(signals: InstagramAuthSignals): boolean {
  const hasLoginForm = signals.hasUsernameInput || signals.hasPasswordInput;
  const hasAuthenticatedUi = signals.hasCreateTrigger || signals.hasFeedNav;
  return !hasLoginForm && hasAuthenticatedUi;
}

export function sanitizeInstagramCaption(caption: string): string {
  let hashtagCount = 0;
  let removedHashtags = 0;

  const withoutExcessHashtags = caption.replace(/(^|\s)(#[A-Za-z0-9_]+)/g, (full, prefix, tag) => {
    hashtagCount += 1;
    if (hashtagCount <= INSTAGRAM_HASHTAG_LIMIT) {
      return `${prefix}${tag}`;
    }
    removedHashtags += 1;
    return prefix || '';
  });

  const normalizedSpacing = withoutExcessHashtags
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  let safeCaption = normalizedSpacing;
  if (removedHashtags > 0) {
    console.warn(
      `[instagram] Caption hashtag count exceeded ${INSTAGRAM_HASHTAG_LIMIT}; removed ${removedHashtags} hashtag(s).`
    );
  }

  if (safeCaption.length > INSTAGRAM_CAPTION_LIMIT) {
    console.warn(
      `[instagram] Caption length ${safeCaption.length} exceeds ${INSTAGRAM_CAPTION_LIMIT}; truncating.`
    );
    safeCaption = `${safeCaption.slice(0, INSTAGRAM_CAPTION_LIMIT - 3).trimEnd()}...`;
  }

  return safeCaption;
}

export function validateInstagramSessionExpiry(
  sessionFile: string = 'storage.json',
  minimumRemainingMs: number = 60 * 60 * 1000
): SessionValidationResult {
  if (!fs.existsSync(sessionFile)) {
    return {
      valid: false,
      reason: `Session file ${sessionFile} not found. Please run saveSession script first.`,
      expiresAt: null,
    };
  }

  const raw = fs.readFileSync(sessionFile, 'utf-8');
  const parsed = JSON.parse(raw) as { cookies?: Array<{ name?: string; expires?: number }> };
  const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];

  if (cookies.length === 0) {
    return {
      valid: false,
      reason: 'Session file has no cookies.',
      expiresAt: null,
    };
  }

  const nowSeconds = Date.now() / 1000;
  const criticalCookies = cookies.filter(
    (cookie) => typeof cookie.name === 'string' && CRITICAL_INSTAGRAM_COOKIES.has(cookie.name)
  );
  const cookiesToValidate = criticalCookies.length > 0 ? criticalCookies : cookies;

  const finiteExpirySeconds = cookiesToValidate
    .map((cookie) => cookie.expires)
    .filter((expires): expires is number => typeof expires === 'number' && Number.isFinite(expires) && expires > 0);

  if (finiteExpirySeconds.length === 0) {
    return {
      valid: false,
      reason: 'Session cookies do not contain a finite expiry.',
      expiresAt: null,
    };
  }

  const minExpirySeconds = Math.min(...finiteExpirySeconds);
  const remainingMs = (minExpirySeconds - nowSeconds) * 1000;
  const expiresAt = new Date(minExpirySeconds * 1000).toISOString();

  if (remainingMs <= minimumRemainingMs) {
    return {
      valid: false,
      reason: `Session expires too soon (${expiresAt}). Re-authentication is required.`,
      expiresAt,
    };
  }

  return {
    valid: true,
    expiresAt,
  };
}

export function assertInstagramSessionReady(
  validation: SessionValidationResult,
  minimumRemainingMs: number,
  sessionFile: string
): void {
  if (validation.valid) {
    return;
  }

  const minimumMinutes = Math.ceil(minimumRemainingMs / 60_000);
  throw new Error(
    `Instagram session validation failed for ${sessionFile}: ${validation.reason || 'Unknown validation error'}. ` +
    `Minimum required remaining time: ${minimumMinutes} minute(s).`
  );
}

export async function publishToInstagram(post: PublishablePost): Promise<void> {
  const sessionFile = 'storage.json';
  const isHeadless = (process.env.PLAYWRIGHT_HEADLESS || 'true').toLowerCase() !== 'false';
  const minimumRemainingMs = Number(process.env.INSTAGRAM_SESSION_MIN_REMAINING_MS || 60 * 60 * 1000);
  
  if (!fs.existsSync(sessionFile)) {
    throw new Error(`Session file ${sessionFile} not found. Please run saveSession script first.`);
  }

  const sessionValidation = validateInstagramSessionExpiry(sessionFile, minimumRemainingMs);
  assertInstagramSessionReady(sessionValidation, minimumRemainingMs, sessionFile);

  for (const mediaPath of post.mediaPaths) {
    if (!fs.existsSync(mediaPath)) {
      throw new Error(`Media file ${mediaPath} not found.`);
    }
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: isHeadless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  
  try {
    const context = await browser.newContext({
      storageState: sessionFile,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log('Navigating to Instagram...');
    // Replace networkidle with domcontentloaded to prevent hanging on medias streams
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await delay(5000); // Give react visual rendering time

    // Explicit authentication guard after UI settles.
    const authSignals = await page.evaluate(() => ({
      hasUsernameInput: Boolean(document.querySelector('input[name="username"]')),
      hasPasswordInput: Boolean(document.querySelector('input[name="password"]')),
      hasFeedNav: Boolean(document.querySelector('nav')),
      hasCreateTrigger: Boolean(
        document.querySelector('svg[aria-label="New post"], svg[aria-label="Create"], a[href="/create/select/"]')
      ),
    }));

    if (!isInstagramAuthenticated(authSignals) || page.url().includes('/login')) {
      const screenshotPath = path.join(os.tmpdir(), `ig-login-check-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      throw new Error(
        `Instagram login state check failed — session may be expired. ` +
        `Screenshot: ${screenshotPath}. Re-authenticate via scripts/saveSession.ts.`
      );
    }

    console.log('Checking for popups (Notifications, Save Login, etc)...');
    for (let i = 0; i < 3; i++) {
      const notNowBtn = page.getByRole('button', { name: 'Not Now', exact: true }).first();
      // Increase visibility timeout slightly; Instagram modals can fade in
      if (await notNowBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Dismissing "Not Now" popup...');
        await notNowBtn.click({ force: true });
        await delay(1500);
      } else {
        break;
      }
    }

    console.log('Clicking "Create" (New post) button...');
    const createNav = page.locator('svg[aria-label="New post"], svg[aria-label="Create"]').first();
    const createText = page.getByRole('link', { name: 'Create' }).first();
    
    if (await createNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createNav.click({ force: true });
    } else if (await createText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createText.click({ force: true });
    } else {
      throw new Error('Could not find Create / New post button.');
    }

    await delay(2000);
    
    // There might be a sub-menu "Post" vs "Reel". If "Post" text appears, click it.
    const postMenuOptions = page.locator('span', { hasText: /^Post$/ }).first();
    if (await postMenuOptions.isVisible()) {
      await postMenuOptions.click({ force: true });
      await delay(2000);
    }
    
    console.log(`Uploading ${post.isCarousel ? 'carousel media' : 'single media'}...`);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    
    // Resolve all paths to absolute paths
    const absoluteMediaPaths = post.mediaPaths.map(p => path.resolve(p));
    
    // Playwright supports array of paths for multiple file upload
    await fileInput.setInputFiles(absoluteMediaPaths);
    
    console.log('Waiting for media upload processing (handling delay)...');
    await delay(5000); 

     await dismissReelInfoModalIfPresent(page, 'post-upload');
    
    console.log('Clicking "Next" on crop step...');
     await dismissReelInfoModalIfPresent(page, 'before-crop-next');
    const nextButton1 = page.getByText('Next', { exact: true }).first();
    await nextButton1.waitFor({ state: 'visible', timeout: 15000 });
    await nextButton1.click({ force: true });
    
    await delay(3000);
    
    console.log('Clicking "Next" on edit step...');
    await dismissReelInfoModalIfPresent(page, 'before-edit-next');
    const nextButton2 = page.getByText('Next', { exact: true }).first();
    await nextButton2.waitFor({ state: 'visible', timeout: 15000 });
    await nextButton2.click({ force: true });

    await delay(3000);

    console.log('Filling caption...');
    const captionEditor = page.locator('div[aria-label="Write a caption..."]');
    await captionEditor.waitFor({ state: 'visible', timeout: 10000 });
    // Focus and type instead of fill can be more robust for some contenteditables
    await captionEditor.focus();
    const safeCaption = sanitizeInstagramCaption(post.caption);
    await page.keyboard.insertText(safeCaption);

    await delay(2000);

    console.log('Clicking "Share" button...');
    let shareClicked = false;
    for (let i = 0; i < 15; i++) {
        // Find all elements with exact text "Share" (this includes hidden SVGs)
        const shareOptions = await page.getByText('Share', { exact: true }).all();
        for (const opt of shareOptions) {
            if (await opt.isVisible().catch(() => false)) {
                // Ensure we don't accidentally interact with a hidden metadata tag
                const tag = await opt.evaluate(el => el.tagName.toLowerCase());
                if (tag !== 'title') {
                    await opt.click({ force: true });
                    shareClicked = true;
                    break;
                }
            }
        }
        if (shareClicked) break;
        await delay(1000); // 1s polling interval
    }

    if (!shareClicked) {
        throw new Error('Share button never became visible or clickable.');
    }

    console.log('Waiting for post to complete...');
    // Confirm publish success via multiple sequential signals to avoid SPA race false-negatives.
    let publishConfirmed = false;

    try {
      await page.waitForSelector('[aria-label="Close"]', { timeout: 5000 });
      publishConfirmed = true;
    } catch {
      // Continue with additional checks.
    }

    if (!publishConfirmed) {
      try {
        await Promise.any([
          page.getByText(/Your reel has been shared/i).waitFor({ state: 'visible', timeout: 10000 }),
          page.getByText(/Your post has been shared/i).waitFor({ state: 'visible', timeout: 10000 }),
          page.locator('img[alt="Animated checkmark"]').waitFor({ state: 'visible', timeout: 10000 }),
          page.waitForURL(/instagram\.com\/(p|reel)\//, { timeout: 10000 }),
        ]);
        publishConfirmed = true;
      } catch {
        console.warn('[instagram] Could not confirm success via DOM; checking URL fallback.');
        const currentUrl = page.url();
        publishConfirmed = currentUrl.includes('/p/') || currentUrl.includes('/reel/');
      }
    }

    if (!publishConfirmed) {
      throw new Error('Instagram publish could not be confirmed — post may or may not have been published');
    }

    console.log('Post successfully published!');
    await delay(3000); 

  } catch (err) {
    console.error('Publishing to Instagram failed:', err);
    throw err; 
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}
