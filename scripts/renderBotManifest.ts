#!/usr/bin/env tsx
/**
 * CLI script to render a bot-produced manifest
 * 
 * Usage:
 *   npm exec tsx -- scripts/renderBotManifest.ts fixtures/bot-manifest-example.json
 *   npm exec tsx -- scripts/renderBotManifest.ts path/to/custom-manifest.json
 * 
 * This script:
 * 1. Loads a bot-produced manifest from a JSON file
 * 2. Validates it through the bot intake service
 * 3. Renders it via the render service (Remotion)
 * 4. Outputs the rendered media paths
 * 
 * NO GEMINI API CALLS - this is a pure bot → Remotion path.
 */

import fs from 'fs';
import path from 'path';
import { processBotIntake } from '../src/pipeline/botManifestService';
import { renderManifest, validateRenderManifest } from '../src/render/renderService';
import type { BotIntakePayload } from '../src/pipeline/botManifestTypes';
import Logger from '../src/utils/logger';

const logger = new Logger('bot-render-cli');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: tsx scripts/renderBotManifest.ts <manifest.json>');
    console.error('');
    console.error('Example:');
    console.error('  tsx scripts/renderBotManifest.ts fixtures/bot-manifest-example.json');
    process.exit(1);
  }

  const manifestPath = path.resolve(args[0]);
  
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Manifest file not found: ${manifestPath}`);
    process.exit(1);
  }

  logger.info('bot-render', 'Loading bot manifest', { path: manifestPath });

  // Load and parse the bot manifest
  let payload: BotIntakePayload;
  try {
    const fileContent = fs.readFileSync(manifestPath, 'utf-8');
    payload = JSON.parse(fileContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('bot-render', 'Failed to parse manifest JSON', { error: message });
    console.error(`Error: Failed to parse JSON: ${message}`);
    process.exit(1);
  }

  // Validate through bot intake service
  logger.info('bot-render', 'Validating bot manifest');
  const intake = processBotIntake(payload);
  
  if (!intake.valid || !intake.content) {
    logger.error('bot-render', 'Bot manifest validation failed', { errors: intake.errors });
    console.error('Error: Bot manifest validation failed:');
    intake.errors?.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  logger.info('bot-render', 'Bot manifest validated successfully', {
    slideCount: intake.content.manifest.carousel.length,
    format: intake.content.manifest.format,
  });

  // Prepare for render
  const renderInput = {
    globalBranding: intake.content.manifest.globalBranding,
    carousel: intake.content.manifest.carousel,
    format: (intake.content.manifest.format === 'mp4' ? 'mp4' : 'png') as 'png' | 'mp4',
  };

  // Validate render manifest
  const validation = validateRenderManifest(renderInput);
  if (validation.error || !validation.normalized) {
    logger.error('bot-render', 'Render validation failed', { error: validation.error });
    console.error(`Error: Render validation failed: ${validation.error}`);
    process.exit(1);
  }

  // Render the manifest
  logger.info('bot-render', 'Starting render', {
    slideCount: validation.normalized.carousel.length,
    format: validation.normalized.format,
  });

  console.log('\n🎬 Rendering bot manifest...\n');

  const startTime = Date.now();
  const result = await renderManifest(validation.normalized);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('bot-render', 'Render completed', {
    batchId: result.batchId,
    slideCount: result.images.length,
    durationSeconds: elapsed,
  });

  // Output results
  console.log('\n✅ Render complete!\n');
  console.log(`Batch ID: ${result.batchId}`);
  console.log(`Duration: ${elapsed}s`);
  console.log(`Media count: ${result.images.length}`);
  console.log('\nRendered media:');
  result.images.forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });

  console.log('\nCaption:');
  console.log(intake.content.caption);
  
  console.log('\nHashtags:');
  console.log(intake.content.hashtags);

  if (intake.sourceArticle) {
    console.log('\nSource article:');
    console.log(`  Title: ${intake.sourceArticle.title}`);
    console.log(`  URL: ${intake.sourceArticle.url}`);
  }

  console.log('\n📁 Rendered files are in /tmp/renders/');
  console.log(`   (files: render-${result.batchId}-*.${validation.normalized.format})\n`);
}

main().catch((error) => {
  console.error('\n❌ Render failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
