import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = path.resolve(__dirname, '..', 'proof-frames', 'editorial');
const TEST_MANIFESTS_DIR = path.resolve(__dirname, '..', 'test-manifests');

const NICHES = [
    'psychology-micro',
    'legal-rights-az',
    'study-hacks',
    'history-flash',
    'ai-tools-daily',
];

// Ensure proof-frames/editorial directory exists
if (!fs.existsSync(PROOF_DIR)) {
    fs.mkdirSync(PROOF_DIR, { recursive: true });
}

console.log('🎬 Rendering editorial proof frames (1080×1350)...\n');

for (const niche of NICHES) {
    const manifestPath = path.join(TEST_MANIFESTS_DIR, `editorial-${niche}.json`);
    
    if (!fs.existsSync(manifestPath)) {
        console.log(`⚠️  Skipping ${niche}: manifest not found`);
        continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    console.log(`🎨 Rendering ${niche}`);
    console.log(`   Handle: ${manifest.branding.handle}\n`);

    // Create niche subdirectory
    const nicheDir = path.join(PROOF_DIR, niche);
    if (!fs.existsSync(nicheDir)) {
        fs.mkdirSync(nicheDir, { recursive: true });
    }

    // Write props to temp file for shell safety
    const tempPropsFile = path.join(nicheDir, 'temp-props.json');
    fs.writeFileSync(tempPropsFile, JSON.stringify(manifest));

    // Frame 0: initial hard visual
    const frame0Path = path.join(nicheDir, 'editorial-frame-0.png');
    console.log(`   → Rendering frame 0 (initial)...`);
    try {
        execSync(
            `npx remotion still src/remotion/index.tsx EditorialSlide "${frame0Path}" --frame=0 --props="${tempPropsFile}"`,
            { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' }
        );
        console.log(`   ✓ Saved: ${frame0Path}`);
    } catch (err) {
        console.error(`   ✗ Failed frame 0: ${err}`);
    }

    // Frame 24: settled with all lines
    const frame24Path = path.join(nicheDir, 'editorial-frame-24.png');
    console.log(`   → Rendering frame 24 (settled)...`);
    try {
        execSync(
            `npx remotion still src/remotion/index.tsx EditorialSlide "${frame24Path}" --frame=24 --props="${tempPropsFile}"`,
            { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' }
        );
        console.log(`   ✓ Saved: ${frame24Path}`);
    } catch (err) {
        console.error(`   ✗ Failed frame 24: ${err}`);
    }

    // Clean up temp file
    fs.unlinkSync(tempPropsFile);
    console.log('');
}

console.log('✨ Editorial proof frames rendered successfully!');
console.log(`📁 Output directory: ${PROOF_DIR}`);
console.log('Done!');
