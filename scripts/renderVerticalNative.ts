#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import type { NicheVoiceManifest } from '../src/bot/types';
import { getNicheConfig } from '../src/bot/nicheConfig';

// Map niche-voice slide roles to Remotion templates
function mapRoleToTemplate(role: string): string {
    const upperRole = role.toUpperCase();
    
    if (['STOP', 'MYTH', 'HOOK', 'SCENARIO', 'OUTCOME', 'HOOK STILL'].includes(upperRole)) {
        return 'HOOK_A';
    }
    if (upperRole === 'FACT') {
        return 'CONTENT_MYTH_VS_FACT';
    }
    if (['CTA', 'TRY TONIGHT', 'DISCLAIMER CTA'].includes(upperRole)) {
        return 'CTA_FINAL';
    }
    if (upperRole.startsWith('STEP_') || upperRole.startsWith('PRINCIPLE_')) {
        return 'CONTENT_LISTICLE';
    }
    if (['WHY IT FAILS', 'WHY', 'CONTEXT', 'EXAMPLE'].includes(upperRole)) {
        return 'CONTENT_GENERIC';
    }
    
    return 'CONTENT_GENERIC';
}

// Convert niche-voice slide to template data
function convertSlideData(slide: any, allSlides: any[], role: string) {
    const upperRole = role.toUpperCase();
    
    if (['STOP', 'MYTH', 'HOOK'].includes(upperRole)) {
        return {
            headline: slide.headline || 'STOP',
            subheadline: slide.body,
            imageUrl: null,
        };
    }
    
    if (['WHY IT FAILS', 'WHY', 'CONTEXT', 'EXAMPLE'].includes(upperRole)) {
        return {
            title: slide.headline,
            body: slide.body,
            highlight: '',
        };
    }
    
    if (upperRole.startsWith('STEP_')) {
        // Extract step number
        const stepMatch = slide.headline.match(/^(\d+)/);
        const stepNum = stepMatch ? parseInt(stepMatch[1]) : 1;
        
        // For listicle, we need to collect multiple steps
        const stepSlides = allSlides.filter(s => s.role.toUpperCase().startsWith('STEP_'));
        const items = stepSlides.map(s => {
            const match = s.headline.match(/^\d+\s*[·•-]\s*(.+)$/);
            return match ? match[1] : s.headline;
        }).slice(0, 4);
        
        // Pad to 4 items if needed
        while (items.length < 4) {
            items.push('...');
        }
        
        return {
            title: 'How to do it',
            items,
            footnote: 'Try this technique tonight',
        };
    }
    
    if (['CTA', 'TRY TONIGHT'].includes(upperRole)) {
        let callToAction = slide.headline;
        if (!callToAction.endsWith('?')) {
            callToAction += '?';
        }
        return {
            callToAction,
            subtext: slide.body,
        };
    }
    
    return {
        headline: slide.headline,
        subheadline: slide.body,
    };
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: npm run render:vertical <path-to-niche-voice-json> [output-path]');
        console.error('Example: npm run render:vertical fixtures/niche-voice/batch-2026-09-12/study-hacks.json');
        process.exit(1);
    }
    
    const inputPath = args[0];
    const outputPath = args[1] || path.join(
        process.cwd(),
        'artifacts',
        'dry-run-2026-09-12',
        'study-hacks',
        'vertical-video.mp4'
    );
    
    console.log(`Loading niche-voice manifest from ${inputPath}...`);
    const inputContent = await fs.readFile(inputPath, 'utf-8');
    const manifest: NicheVoiceManifest = JSON.parse(inputContent);
    
    console.log(`Processing ${manifest.niche} manifest: "${manifest.title}"`);
    
    // Get niche configuration
    const nicheConfig = getNicheConfig(manifest.niche);
    
    // Track which slides have been processed (for grouping STEP_ slides)
    const processedIndices = new Set<number>();
    const verticalSlides: any[] = [];
    
    // Convert slides
    for (let i = 0; i < manifest.slides.length; i++) {
        if (processedIndices.has(i)) continue;
        
        const slide = manifest.slides[i];
        const templateId = mapRoleToTemplate(slide.role);
        
        // Special handling for STEP_ slides - group them into one listicle
        if (slide.role.toUpperCase().startsWith('STEP_')) {
            // Find all step slides
            const stepSlides = manifest.slides.filter(s => 
                s.role.toUpperCase().startsWith('STEP_')
            );
            
            // Mark all step slides as processed
            manifest.slides.forEach((s, idx) => {
                if (s.role.toUpperCase().startsWith('STEP_')) {
                    processedIndices.add(idx);
                }
            });
            
            // Calculate total duration for all steps
            const totalDuration = stepSlides.reduce((sum, s) => sum + s.durationSec, 0);
            
            verticalSlides.push({
                templateId: 'CONTENT_LISTICLE',
                data: convertSlideData(slide, manifest.slides, slide.role),
                durationSeconds: totalDuration,
            });
            continue;
        }
        
        processedIndices.add(i);
        
        verticalSlides.push({
            templateId,
            data: convertSlideData(slide, manifest.slides, slide.role),
            durationSeconds: slide.durationSec,
        });
    }
    
    console.log(`\nConverted ${verticalSlides.length} slides:`);
    verticalSlides.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.templateId} (${s.durationSeconds}s)`);
    });
    
    // Prepare render props
    const inputProps = {
        slides: verticalSlides,
        branding: {
            niche: manifest.niche,
            accentColor: nicheConfig.accentColor,
            handle: nicheConfig.handle,
            effects: nicheConfig.effects,
        },
    };
    
    // Calculate total duration
    const totalDuration = verticalSlides.reduce((sum, s) => sum + s.durationSeconds, 0);
    console.log(`\nTotal duration: ${totalDuration}s`);
    console.log(`FPS: ${manifest.fps}`);
    console.log(`Resolution: 1080x1920 (9:16)`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Bundle Remotion
    console.log('\nBundling Remotion...');
    const bundleLocation = await bundle({
        entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.tsx'),
        webpackOverride: (config) => config,
    });
    
    console.log('Bundle complete. Selecting composition...');
    
    // Select composition
    const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: 'VerticalNative',
        inputProps,
    });
    
    console.log(`Composition selected: ${composition.width}x${composition.height} @ ${composition.fps}fps`);
    console.log(`Duration: ${composition.durationInFrames} frames (${composition.durationInFrames / composition.fps}s)`);
    
    // Render
    console.log(`\nRendering to ${outputPath}...`);
    
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
        onProgress: ({ progress, renderedFrames, encodedFrames }) => {
            const pct = (progress * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${pct}% (rendered: ${renderedFrames}, encoded: ${encodedFrames})`);
        },
    });
    
    console.log(`\n\n✓ Render complete!`);
    console.log(`\nOutput: ${outputPath}`);
    
    // Check file size
    const stats = await fs.stat(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Size: ${sizeMB} MB`);
    
    // Write manifest
    const manifestPath = path.join(outputDir, 'MANIFEST.json');
    const manifestData = {
        niche: manifest.niche,
        target: 'vertical-video',
        composition: 'VerticalNative',
        resolution: '1080x1920',
        fps: manifest.fps,
        duration: totalDuration,
        outputPath: outputPath,
        outputRelative: path.relative(process.cwd(), outputPath),
        fileSize: stats.size,
        fileSizeMB: parseFloat(sizeMB),
        slides: verticalSlides.map(s => ({
            template: s.templateId,
            duration: s.durationSeconds,
        })),
        captions: {
            instagram: manifest.captions.instagram,
            tiktok: manifest.captions.tiktok,
            youtubeShorts: manifest.captions.youtubeShorts,
        },
        rendered: new Date().toISOString(),
    };
    
    await fs.writeFile(manifestPath, JSON.stringify(manifestData, null, 2));
    console.log(`Manifest: ${manifestPath}`);
    
    console.log(`\n✓ Done! Video ready for publisher handoff.`);
}

main().catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});
