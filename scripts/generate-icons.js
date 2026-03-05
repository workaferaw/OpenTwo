const sharp = require('sharp');
const path = require('path');

// Icon mark SVG — the 3-stroke OpenTwo symbol
// viewBox is 0 0 80 102, but actual content spans roughly x:13..81, y:9..92
// Geometric center: ~47, ~51. We use viewBox to center it properly.
const ICON_MARK_SVG = `
<svg viewBox="0 0 94 102" xmlns="http://www.w3.org/2000/svg">
  <path d="M14.1,19.56l7.92-7.92c1.54-1.54,4.18-.45,4.18,1.73v74.89c0,2.18-2.64,3.28-4.18,1.73l-8.02-8.02c-.46-.46-.72-1.08-.72-1.73.02-6.68.11-44.5.11-58.97,0-.64.26-1.26.71-1.71Z" fill="#0a0a0c"/>
  <path d="M30.74,19.64l18.97-10.02c1.63-.86,3.6.32,3.6,2.17v78.42c0,1.83-1.92,3.01-3.55,2.19l-18.96-9.56c-.83-.42-1.35-1.26-1.35-2.19V21.8c0-.91.5-1.74,1.3-2.16Z" fill="#0a0a0c"/>
  <path d="M57.83,19.64l18.97-10.02c1.63-.86,3.6.32,3.6,2.17v78.42c0,1.83-1.92,3.01-3.55,2.19l-18.96-9.56c-.83-.42-1.35-1.26-1.35-2.19V21.8c0-.91.5-1.74,1.3-2.16Z" fill="#0a0a0c"/>
</svg>
`.trim();

async function generateIcon(size, outputPath) {
  const cornerRadius = Math.round(size * 0.22);

  // Logo takes 55% of the icon size for visual balance
  const logoSize = Math.round(size * 0.55);
  const logoLeft = Math.round((size - logoSize) / 2);
  const logoTop = Math.round((size - logoSize) / 2);

  const backgroundSvg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#b8d41e"/>
</svg>
`.trim();

  const logoBuffer = await sharp(Buffer.from(ICON_MARK_SVG))
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(Buffer.from(backgroundSvg))
    .png()
    .composite([
      {
        input: logoBuffer,
        top: logoTop,
        left: logoLeft,
      },
    ])
    .toFile(outputPath);

  console.log(`Created: ${outputPath} (${size}x${size})`);
}

async function main() {
  const buildDir = path.join(__dirname, '..', 'build');

  await generateIcon(256, path.join(buildDir, 'icon.png'));
  await generateIcon(32, path.join(buildDir, 'tray-icon.png'));
  await generateIcon(512, path.join(buildDir, 'icon-512.png'));

  console.log('Icon generation complete!');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
