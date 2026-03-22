const sharp = require('sharp');

async function generateIconsWithPadding() {
  const sourcePath = 'bitecards.png';
  
  // Размеры с padding для разных браузеров
  const configs = [
    { size: 192, padding: 16, name: 'icon-192x192.png' },
    { size: 512, padding: 42, name: 'icon-512x512.png' },
    { size: 96, padding: 8, name: 'icon-96x96.png' },
    { size: 144, padding: 12, name: 'icon-144x144.png' },
    { size: 384, padding: 32, name: 'icon-384x384.png' },
  ];
  
  try {
    console.log('Генерация иконок с padding...\n');
    
    for (const { size, padding, name } of configs) {
      const innerSize = size - (padding * 2);
      
      // Сначала ресайзим исходник под innerSize
      const resized = await sharp(sourcePath)
        .resize(innerSize, innerSize, {
          fit: 'fill',
          kernel: 'lanczos3'
        })
        .png()
        .toBuffer();
      
      // Затем добавляем прозрачный padding
      await sharp(resized)
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ compressionLevel: 9 })
        .toFile(name);
      
      console.log(`✓ ${name} (${size}x${size}) с padding ${padding}px`);
    }
    
    // Favicon без padding
    await sharp(sourcePath)
      .resize(32, 32, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toFile('favicon.png');
    console.log(`✓ favicon.png (32x32)`);
    
    console.log('\n✅ Готово! Все иконки сгенерированы с отступами.');
    console.log('📌 Теперь иконки будут по центру в Safari и Chrome!');
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

generateIconsWithPadding();
