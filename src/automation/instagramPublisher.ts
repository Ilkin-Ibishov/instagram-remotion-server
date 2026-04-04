import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import type { PublishablePost } from '../pipeline/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function publishToInstagram(post: PublishablePost): Promise<void> {
  const sessionFile = 'storage.json';
  
  if (!fs.existsSync(sessionFile)) {
    throw new Error(`Session file ${sessionFile} not found. Please run saveSession script first.`);
  }

  for (const mediaPath of post.mediaPaths) {
    if (!fs.existsSync(mediaPath)) {
      throw new Error(`Media file ${mediaPath} not found.`);
    }
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  
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

    // Explicit authentication guard
    if (page.url().includes('/login')) {
      throw new Error('Authentication failed: Session expired or invalid. Please run the saveSession script to authenticate.');
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
    
    // Check if there is an OK button on "Video uploads are now reels" modal
    const okButton = page.getByRole('button', { name: 'OK' }).first();
    if (await okButton.isVisible({ timeout: 2000 })) {
       console.log('Dismissing "Reels" info modal...');
       await okButton.click({ force: true });
       await delay(1000);
    }
    
    console.log('Clicking "Next" on crop step...');
    const nextButton1 = page.getByText('Next', { exact: true }).first();
    await nextButton1.waitFor({ state: 'visible', timeout: 15000 });
    await nextButton1.click({ force: true });
    
    await delay(3000);
    
    console.log('Clicking "Next" on edit step...');
    const nextButton2 = page.getByText('Next', { exact: true }).first();
    await nextButton2.waitFor({ state: 'visible', timeout: 15000 });
    await nextButton2.click({ force: true });

    await delay(3000);

    console.log('Filling caption...');
    const captionEditor = page.locator('div[aria-label="Write a caption..."]');
    await captionEditor.waitFor({ state: 'visible', timeout: 10000 });
    // Focus and type instead of fill can be more robust for some contenteditables
    await captionEditor.focus();
    await page.keyboard.insertText(post.caption);

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
    // Look for success messages
    const sharedText = page.getByText(/has been shared/i);
    const successImg = page.locator('img[alt="Animated checkmark"]');
    
    await Promise.race([
      sharedText.waitFor({ state: 'visible', timeout: 60000 }),
      successImg.waitFor({ state: 'visible', timeout: 60000 })
    ]);

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
