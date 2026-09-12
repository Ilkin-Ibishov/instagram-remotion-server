#!/usr/bin/env tsx
/**
 * Multi-niche test script
 * 
 * Renders all 5 locked niche manifests to prove multi-niche config works.
 * 
 * Usage:
 *   npm exec tsx -- scripts/testMultiNiche.ts
 */

import fs from 'fs';
import path from 'path';
import { processBotIntake } from '../src/pipeline/botManifestService';
import { renderManifest, validateRenderManifest } from '../src/render/renderService';
import { getAllNicheIds, getNicheBrandProfile } from '../src/pipeline/nicheConfig';
import type { BotIntakePayload } from '../src/pipeline/botManifestTypes';
import Logger from '../src/utils/logger';

const logger = new Logger('multi-niche-test');

async function testNiche(nicheId: string) {
  const fixtureFile = `fixtures/bot-manifest-${nicheId}.json`;
  const fixturePath = path.resolve(fixtureFile);

  if (!fs.existsSync(fixturePath)) {
    logger.error('multi-niche-test', `Fixture not found for niche: ${nicheId}`, { path: fixturePath });
    throw new Error(`Fixture not found: ${fixtureFile}`);
  }

  logger.info('multi-niche-test', `Testing niche: ${nicheId}`, { fixture: fixtureFile });

  // Load manifest
  const fileContent = fs.readFileSync(fixturePath, 'utf-8');
  const payload: BotIntakePayload = JSON.parse(fileContent);

  // Validate through bot intake
  const intake = processBotIntake(payload);
  if (!intake.valid || !intake.content) {
    logger.error('multi-niche-test', 'Bot manifest validation failed', {
      nicheId,
      errors: intake.errors,
    });
    throw new Error(`Validation failed for ${nicheId}: ${intake.errors?.join(', ')}`);
  }

  const brandProfile = getNicheBrandProfile(intake.nicheId!);
  logger.info('multi-niche-test', 'Niche validated', {
    nicheId: intake.nicheId,
    handle: brandProfile.handle,
    slideCount: intake.content.manifest.carousel.length,
  });

  // Prepare render input
  const renderInput = {
    globalBranding: intake.content.manifest.globalBranding,
    carousel: intake.content.manifest.carousel,
    format: (intake.content.manifest.format === 'mp4' ? 'mp4' : 'png') as 'png' | 'mp4',
  };

  const validation = validateRenderManifest(renderInput);
  if (validation.error || !validation.normalized) {
    throw new Error(`Render validation failed for ${nicheId}: ${validation.error}`);
  }

  // Render
  const startTime = Date.now();
  const result = await renderManifest(validation.normalized);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('multi-niche-test', 'Niche rendered successfully', {
    nicheId: intake.nicheId,
    batchId: result.batchId,
    mediaCount: result.images.length,
    durationSeconds: elapsed,
  });

  return {
    nicheId: intake.nicheId,
    handle: brandProfile.handle,
    batchId: result.batchId,
    mediaCount: result.images.length,
    durationSeconds: elapsed,
    images: result.images,
  };
}

async function main() {
  console.log('🎬 Multi-Niche Render Test\n');
  console.log('Testing all 5 locked niches...\n');

  const allNiches = getAllNicheIds();
  const results: any[] = [];

  for (const nicheId of allNiches) {
    try {
      console.log(`\n▶️  Rendering ${nicheId}...`);
      const result = await testNiche(nicheId);
      results.push(result);
      console.log(`✅ ${nicheId} complete (${result.mediaCount} files, ${result.durationSeconds}s)`);
    } catch (error) {
      console.error(`❌ ${nicheId} failed:`, error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  console.log('\n\n🎉 All niches rendered successfully!\n');
  console.log('Results summary:\n');

  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.nicheId} (@${r.handle})`);
    console.log(`   Batch: ${r.batchId}`);
    console.log(`   Files: ${r.mediaCount} MP4s`);
    console.log(`   Time: ${r.durationSeconds}s\n`);
  });

  const totalDuration = results.reduce((sum, r) => sum + parseFloat(r.durationSeconds), 0);
  const totalFiles = results.reduce((sum, r) => sum + r.mediaCount, 0);

  console.log(`Total: ${totalFiles} files in ${totalDuration.toFixed(1)}s\n`);
  console.log('📁 All rendered files are in /tmp/renders/\n');
}

main().catch((error) => {
  console.error('\n❌ Multi-niche test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
