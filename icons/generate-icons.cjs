const sharp = require('sharp');
const fs = require('fs');

async function generateIcons() {
  const sourcePath = 'bitecards.png';
  const sizes = [
    { size: 192, name: 'icon-192x192.png' },
    { size: 512, name: 'icon-512x512.png' },
    { size: 96, name: 'icon-96x96.png' },
    { size: 144, name: 'icon-144x144.png' },
    { size: 384, name: 'icon-384x384.png' },
    { size: 32, name: 'favicon.png' }
  ];
  
  try {
    console.log('Генерация иконок...\n');
    
    for (const { size, name } of sizes) {
      const outputPath = name;
      
      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'fill',
          kernel: 'lanczos3'
        })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);
      
      console.log(`✓ ${name} (${size}x${size})`);
    }
    
    console.log('\n✅ Готово! Все иконки сгенерированы.');
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

generateIcons();
