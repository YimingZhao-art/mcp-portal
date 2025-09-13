const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="#1E40AF"/>
  <path d="M128 192H192V320H128V192Z" fill="white"/>
  <path d="M224 128H288V320H224V128Z" fill="white"/>
  <path d="M320 256H384V320H320V256Z" fill="white"/>
  <circle cx="160" cy="160" r="32" fill="white"/>
  <circle cx="256" cy="96" r="32" fill="white"/>
  <circle cx="352" cy="224" r="32" fill="white"/>
</svg>`;

const traySvgContent = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="22" height="22" rx="4" fill="#1E40AF"/>
  <path d="M6 9H8V15H6V9Z" fill="white"/>
  <path d="M10 6H12V15H10V6Z" fill="white"/>
  <path d="M14 12H16V15H14V12Z" fill="white"/>
  <circle cx="7" cy="7.5" r="1.5" fill="white"/>
  <circle cx="11" cy="4.5" r="1.5" fill="white"/>
  <circle cx="15" cy="10.5" r="1.5" fill="white"/>
</svg>`;

async function generateIcons() {
  const assetsDir = path.join(__dirname, '../assets');
  
  // Create assets directory if it doesn't exist
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Generate main icon (512x512)
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  
  console.log('Generated icon.png (512x512)');

  // Generate tray icon (22x22 for macOS)
  await sharp(Buffer.from(traySvgContent))
    .resize(22, 22)
    .png()
    .toFile(path.join(assetsDir, 'tray-icon.png'));
  
  console.log('Generated tray-icon.png (22x22)');

  // Generate Windows icon (256x256)
  await sharp(Buffer.from(svgContent))
    .resize(256, 256)
    .toFile(path.join(assetsDir, 'icon.ico'));
  
  console.log('Generated icon.ico (256x256)');

  // Generate macOS icon set (will need iconutil on macOS to convert to .icns)
  const iconsetDir = path.join(assetsDir, 'icon.iconset');
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  const sizes = [16, 32, 64, 128, 256, 512];
  for (const size of sizes) {
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));
    
    // Create @2x versions
    if (size <= 256) {
      await sharp(Buffer.from(svgContent))
        .resize(size * 2, size * 2)
        .png()
        .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
    }
  }
  
  console.log('Generated macOS iconset');
  console.log('Note: Run "iconutil -c icns assets/icon.iconset" on macOS to create icon.icns');
}

generateIcons().catch(console.error);