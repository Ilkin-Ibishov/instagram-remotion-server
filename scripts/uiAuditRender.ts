#!/usr/bin/env tsx
/**
 * UI Audit Render Script
 * 
 * Renders the psychology-micro test manifest and extracts still PNG frames
 * from mid-slide for visual UI/UX audit.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RenderManifest } from '../src/render/renderService';
import { renderManifest } from '../src/render/renderService';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    console.log('🎬 UI Audit Render - psychology-micro\n');

    // Load test manifest
    const manifestPath = path.join(__dirname, '../fixtures/psychology-micro-test.json');
    const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    const manifest: RenderManifest = {
        format: 'mp4',
        carousel: rawManifest.carousel,
        globalBranding: rawManifest.globalBranding,
    };

    console.log(`📋 Template sequence: ${manifest.carousel.map(s => s.templateId).join(' → ')}\n`);

    // Render slides
    console.log('▶️  Rendering slides...\n');
    const renderResult = await renderManifest(manifest, 'psychology-micro-audit');

    if (!renderResult.success) {
        console.error('❌ Render failed:', renderResult.error);
        process.exit(1);
    }

    console.log(`✅ Rendered ${renderResult.images.length} slides\n`);

    // Extract still frames from each video
    const stillsDir = path.join(__dirname, '../artifacts/ui-audit-2026-09-12');
    fs.mkdirSync(stillsDir, { recursive: true });

    console.log('📸 Extracting mid-slide still frames...\n');

    for (let i = 0; i < renderResult.images.length; i++) {
        const videoPath = renderResult.images[i];
        const templateId = manifest.carousel[i].templateId;
        const stillPath = path.join(stillsDir, `slide-${i + 1}-${templateId}.png`);

        try {
            // Extract frame at 50% of video duration (mid-slide)
            execSync(`ffmpeg -i "${videoPath}" -vf "select=eq(n\\,75)" -frames:v 1 -y "${stillPath}" 2>/dev/null`, {
                stdio: 'ignore',
            });
            console.log(`  ✓ slide-${i + 1}-${templateId}.png`);
        } catch (error) {
            console.error(`  ✗ Failed to extract frame ${i + 1}:`, error);
        }
    }

    console.log(`\n📁 Still frames saved to: ${stillsDir}`);
    console.log(`📁 Video slides saved to: ${path.dirname(renderResult.images[0])}`);
    
    console.log('\n✅ UI audit render complete!');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
