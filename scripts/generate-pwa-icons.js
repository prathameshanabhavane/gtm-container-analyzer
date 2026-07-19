/**
 * PWA Icon Generator
 * Run: node scripts/generate-pwa-icons.js
 * 
 * Generates PNG icons for PWA from your SVG favicon.
 * Only needs to be run once, or when you update the favicon.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const SIZES = [192, 512];

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');
  
  const svgPath = path.join(publicDir, 'favicon.svg');
  const svg = fs.readFileSync(svgPath);
  
  for (const size of SIZES) {
    const outputPath = path.join(publicDir, `pwa-${size}x${size}.png`);
    
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Created pwa-${size}x${size}.png`);
  }
  
  console.log('\n✨ PWA icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
