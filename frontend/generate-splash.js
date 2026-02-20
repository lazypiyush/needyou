const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.join(__dirname, 'public', 'logo.jpg');
const RES_DIR = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Splash screen sizes: bigger, centred on a dark background
const splashConfigs = [
    { folder: 'drawable', w: 480, h: 480 },
    { folder: 'drawable-port-mdpi', w: 320, h: 480 },
    { folder: 'drawable-port-hdpi', w: 480, h: 800 },
    { folder: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { folder: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
    { folder: 'drawable-land-mdpi', w: 480, h: 320 },
    { folder: 'drawable-land-hdpi', w: 800, h: 480 },
    { folder: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { folder: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
];

async function generate() {
    for (const { folder, w, h } of splashConfigs) {
        const dir = path.join(RES_DIR, folder);
        fs.mkdirSync(dir, { recursive: true });

        // Logo centered (200px) on dark background
        const logoSize = Math.min(w, h, 300);

        await sharp({
            create: { width: w, height: h, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
        })
            .composite([{
                input: await sharp(SOURCE).resize(logoSize, logoSize, { fit: 'cover' }).png().toBuffer(),
                gravity: 'centre',
            }])
            .png()
            .toFile(path.join(dir, 'splash.png'));

        console.log(`✅ ${folder}/splash.png (${w}x${h})`);
    }
    console.log('\n🎉 Splash images done!');
}

generate().catch(console.error);
