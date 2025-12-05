/**
 * 生成 PWA 图标
 * 使用 weather_duck.jpg 作为源图片生成各种尺寸的 PNG 图标
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '../public');
const iconsDir = join(publicDir, 'icons');

// 确保 icons 目录存在
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// 源图片
const sourceImage = join(publicDir, 'weather_duck.jpg');

// PWA 需要的图标尺寸
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('开始生成 PWA 图标...');
  console.log('源图片:', sourceImage);
  
  for (const size of sizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
    
    await sharp(sourceImage)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ 生成 icon-${size}x${size}.png`);
  }
  
  // 生成 apple-touch-icon (180x180)
  const appleTouchIconPath = join(publicDir, 'apple-touch-icon.png');
  await sharp(sourceImage)
    .resize(180, 180, {
      fit: 'cover',
      position: 'center'
    })
    .png()
    .toFile(appleTouchIconPath);
  console.log('✓ 生成 apple-touch-icon.png (180x180)');
  
  // 生成 favicon (32x32)
  const faviconPath = join(publicDir, 'favicon.png');
  await sharp(sourceImage)
    .resize(32, 32, {
      fit: 'cover',
      position: 'center'
    })
    .png()
    .toFile(faviconPath);
  console.log('✓ 生成 favicon.png (32x32)');
  
  // 生成 favicon.ico (32x32)
  const faviconIcoPath = join(publicDir, 'favicon.ico');
  await sharp(sourceImage)
    .resize(32, 32, {
      fit: 'cover',
      position: 'center'
    })
    .toFile(faviconIcoPath);
  console.log('✓ 生成 favicon.ico (32x32)');
  
  console.log('\n所有图标生成完成！');
}

generateIcons().catch(console.error);
