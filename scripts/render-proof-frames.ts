#!/usr/bin/env tsx
/**
 * Render proof frames for the design system
 * 
 * Generates still frames from test manifests to demonstrate:
 * - Niche-specific color palettes
 * - Safe zone implementation
 * - Hook frame readability
 * - Typography hierarchy
 * 
 * Usage:
 *   tsx scripts/render-proof-frames.ts
 */

import { bundle } from '@remotion/bundler';
import { renderStill } from '@remotion/renderer';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPOSITION_ID = 'Slide';
const REMOTION_ENTRY = path.resolve(__dirname, '../src/remotion/index.tsx');
const OUTPUT_DIR = path.resolve(__dirname, '../proof-frames');
const TEST_MANIFESTS_DIR = path.resolve(__dirname, '../test-manifests');

interface SlideProps {
  templateId: string;
  data: Record<string, any>;
  branding: {
    niche?: string;
    handle: string;
    accentColor: string;
    effects: string[];
  };
}

interface Manifest {
  global: {
    branding: {
      niche?: string;
      handle: string;
      accentColor: string;
      effects: string[];
    };
  };
  carousel: Array<{
    templateId: string;
    data: Record<string, any>;
  }>;
}

async function renderProofFrames() {
  console.log('📦 Bundling Remotion project...');
  const bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY,
    webpackOverride: (config) => config,
  });

  console.log('✅ Bundle complete:', bundleLocation);
  console.log('');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Render frames for each test manifest
  const manifests = [
    'psychology-micro.json',
    'legal-rights-az.json',
    'study-hacks.json',
    'history-flash.json',
    'ai-tools-daily.json',
  ];

  for (const manifestFile of manifests) {
    const manifestPath = path.join(TEST_MANIFESTS_DIR, manifestFile);
    
    if (!fs.existsSync(manifestPath)) {
      console.warn(`⚠️  Manifest not found: ${manifestFile}, skipping...`);
      continue;
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const niche = manifest.global.branding.niche || 'psychology-micro';
    const nicheDir = path.join(OUTPUT_DIR, niche);

    if (!fs.existsSync(nicheDir)) {
      fs.mkdirSync(nicheDir, { recursive: true });
    }

    console.log(`🎨 Rendering frames for niche: ${niche}`);
    console.log(`   Handle: ${manifest.global.branding.handle}`);
    console.log('');

    // Render hook frame (first slide, frame 0 - must be readable immediately)
    if (manifest.carousel.length > 0) {
      const hookSlide = manifest.carousel[0];
      const hookProps: SlideProps = {
        templateId: hookSlide.templateId,
        data: hookSlide.data,
        branding: manifest.global.branding,
      };

      const hookFramePath = path.join(nicheDir, 'hook-frame-0.png');
      console.log(`   → Rendering hook frame (${hookSlide.templateId})...`);
      
      await renderStill({
        composition: {
          id: COMPOSITION_ID,
          width: 1080,
          height: 1080,
          fps: 30,
          durationInFrames: 720,
          defaultProps: hookProps,
        },
        serveUrl: bundleLocation,
        output: hookFramePath,
        frame: 0, // Frame 0 - must be readable for Instagram thumbnail
      });

      console.log(`   ✓ Saved: ${hookFramePath}`);

      // Also render hook at frame 18 (fully settled)
      const hookSettledPath = path.join(nicheDir, 'hook-frame-18.png');
      await renderStill({
        composition: {
          id: COMPOSITION_ID,
          width: 1080,
          height: 1080,
          fps: 30,
          durationInFrames: 720,
          defaultProps: hookProps,
        },
        serveUrl: bundleLocation,
        output: hookSettledPath,
        frame: 18,
      });

      console.log(`   ✓ Saved: ${hookSettledPath}`);
    }

    // Render mid-content frame (second slide if available)
    if (manifest.carousel.length > 1) {
      const midSlide = manifest.carousel[1];
      const midProps: SlideProps = {
        templateId: midSlide.templateId,
        data: midSlide.data,
        branding: manifest.global.branding,
      };

      const midFramePath = path.join(nicheDir, `mid-${midSlide.templateId}-frame-24.png`);
      console.log(`   → Rendering mid frame (${midSlide.templateId})...`);
      
      await renderStill({
        composition: {
          id: COMPOSITION_ID,
          width: 1080,
          height: 1080,
          fps: 30,
          durationInFrames: 720,
          defaultProps: midProps,
        },
        serveUrl: bundleLocation,
        output: midFramePath,
        frame: 24, // Fully settled
      });

      console.log(`   ✓ Saved: ${midFramePath}`);
    }

    // Render end frame (last slide - typically CTA)
    if (manifest.carousel.length > 2) {
      const endSlide = manifest.carousel[manifest.carousel.length - 1];
      const endProps: SlideProps = {
        templateId: endSlide.templateId,
        data: endSlide.data,
        branding: manifest.global.branding,
      };

      const endFramePath = path.join(nicheDir, `end-${endSlide.templateId}-frame-24.png`);
      console.log(`   → Rendering end frame (${endSlide.templateId})...`);
      
      await renderStill({
        composition: {
          id: COMPOSITION_ID,
          width: 1080,
          height: 1080,
          fps: 30,
          durationInFrames: 720,
          defaultProps: endProps,
        },
        serveUrl: bundleLocation,
        output: endFramePath,
        frame: 24,
      });

      console.log(`   ✓ Saved: ${endFramePath}`);
    }

    console.log('');
  }

  console.log('✨ All proof frames rendered successfully!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review frames in proof-frames/ directory');
  console.log('  2. Verify hook readability (frame 0)');
  console.log('  3. Check safe zone compliance');
  console.log('  4. Confirm niche-specific color palettes');
}

// Run
renderProofFrames()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error rendering proof frames:', err);
    process.exit(1);
  });
