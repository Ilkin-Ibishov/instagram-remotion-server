import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('Navigating to Instagram login...');
  await page.goto('https://www.instagram.com/');

  console.log('----------------------------------------------------');
  console.log('Please log in manually in the opened browser window.');
  console.log('The script will wait until you reach the home feed.');
  console.log('----------------------------------------------------');

  try {
    // Wait until the 'Home' SVG is visible, indicating a successful login
    await page.waitForSelector('svg[aria-label="Home"]', { timeout: 180000 }); // 3 minutes timeout
    console.log('Login detected! Saving session...');
  } catch (e) {
    console.log('Timeout (3m) reached waiting for Home icon, or user closed the page.');
    console.log('Attempting to save session anyway...');
  }

  const sessionPath = path.resolve('storage.json');
  await context.storageState({ path: sessionPath });
  console.log(`Session saved successfully to: ${sessionPath}`);

  await browser.close();
}

main().catch(console.error);
