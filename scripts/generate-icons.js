const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');
const sharp = require('sharp');

async function main() {
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const inputArg = process.argv[2];
    const inputPng = inputArg
      ? path.resolve(repoRoot, inputArg)
      : path.resolve(repoRoot, 'client', 'src', 'assets', 'edited-photo.png');

    if (!fs.existsSync(inputPng)) {
      console.error(`[icons] Input PNG not found: ${inputPng}`);
      process.exit(1);
    }

    const outDir = path.resolve(repoRoot, 'build');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outIco = path.join(outDir, 'icon.ico');
    const outPng = path.join(outDir, 'icon.png');

    console.log(`[icons] Preparing square 256x256 PNG from ${inputPng}`);
    const processedPngBuffer = await sharp(inputPng)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    fs.writeFileSync(outPng, processedPngBuffer);

    console.log(`[icons] Generating ICO -> ${outIco}`);
    const icoBuf = await pngToIco([processedPngBuffer]);
    fs.writeFileSync(outIco, icoBuf);

    console.log('[icons] Done.');
  } catch (err) {
    console.error('[icons] Failed to generate icon:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
