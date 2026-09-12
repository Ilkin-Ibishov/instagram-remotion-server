#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import { convertNicheVoiceManifest } from '../src/bot/converter';
import type { NicheVoiceManifest, BotIntakePayload } from '../src/bot/types';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: npm run bot:render-voice <path-to-niche-voice-json> [--render]');
        console.error('       npm run bot:render-voice fixtures/niche-voice/psychology-micro.json --render');
        process.exit(1);
    }

    const inputPath = args[0];
    const shouldRender = args.includes('--render');

    console.log(`Loading niche-voice manifest from ${inputPath}...`);

    // Load and parse input
    const inputContent = await fs.readFile(inputPath, 'utf-8');
    const nicheVoiceManifest: NicheVoiceManifest = JSON.parse(inputContent);

    console.log(`Converting ${nicheVoiceManifest.niche} manifest...`);

    // Convert to bot intake format
    const botIntake: BotIntakePayload = convertNicheVoiceManifest(nicheVoiceManifest);

    // Save converted output
    const outputDir = path.join(process.cwd(), 'fixtures', 'bot-manifests');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(
        outputDir,
        `${nicheVoiceManifest.niche}-converted.json`
    );

    await fs.writeFile(outputPath, JSON.stringify(botIntake, null, 2));
    console.log(`✓ Converted manifest saved to ${outputPath}`);

    // Print summary
    const carousel = botIntake.manifest.manifest.carousel;
    console.log(`\nCarousel summary:`);
    console.log(`  - Slides: ${carousel.length}`);
    console.log(`  - Templates: ${carousel.map((s) => s.templateId).join(', ')}`);
    console.log(`  - Distinct templates: ${new Set(carousel.map((s) => s.templateId)).size}`);
    console.log(`  - Hashtags: ${botIntake.manifest.hashtags.split('#').length - 1}`);
    console.log(`  - Caption lines: ${botIntake.manifest.caption.split('\n').filter((l) => l.trim()).length}`);

    if (!shouldRender) {
        console.log('\nSkipping render. Use --render flag to render the video.');
        return;
    }

    console.log('\nRendering video...');

    // Ensure render directory exists
    const renderDir = path.join(process.cwd(), 'tmp', 'renders');
    await fs.mkdir(renderDir, { recursive: true });

    // Bundle Remotion
    console.log('Bundling Remotion...');
    const bundleLocation = await bundle({
        entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.tsx'),
        webpackOverride: (config) => config,
    });

    console.log('Bundle complete. Starting render...');

    const { manifest: renderManifest } = botIntake.manifest;
    const { globalBranding, carousel: slides } = renderManifest;

    // Render each slide
    for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        console.log(`\nRendering slide ${i + 1}/${slides.length} (${slide.templateId})...`);

        const inputProps = {
            templateId: slide.templateId,
            data: slide.data,
            branding: globalBranding,
        };

        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: 'Slide',
            inputProps,
        });

        const outputPath = path.join(
            renderDir,
            `${nicheVoiceManifest.niche}-slide-${i + 1}-${slide.templateId}.mp4`
        );

        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation: outputPath,
            inputProps,
            chromiumOptions: {
                disableWebSecurity: true,
                ignoreCertificateErrors: true,
                gl: 'angle',
            },
            onProgress: ({ progress }) => {
                if (progress % 0.1 < 0.01) {
                    process.stdout.write(`\r  Progress: ${(progress * 100).toFixed(0)}%`);
                }
            },
        });

        console.log(`\r  ✓ Rendered to ${outputPath}`);
    }

    console.log(`\n✓ All ${slides.length} slides rendered successfully!`);
    console.log(`\nOutput directory: ${renderDir}`);
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
