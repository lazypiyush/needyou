const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.join(__dirname, 'public', 'logo.jpg');
const RES_DIR = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const sizes = [
    { folder: 'mipmap-mdpi', size: 48 },
    { folder: 'mipmap-hdpi', size: 72 },
    { folder: 'mipmap-xhdpi', size: 96 },
    { folder: 'mipmap-xxhdpi', size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function generateIcons() {
    for (const { folder, size } of sizes) {
        const outDir = path.join(RES_DIR, folder);
        fs.mkdirSync(outDir, { recursive: true });

        for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
            await sharp(SOURCE)
                .resize(size, size, { fit: 'cover' })
                .png()
                .toFile(path.join(outDir, name));
            console.log(`✅ ${folder}/${name} (${size}x${size})`);
        }
    }
    console.log('\n🎉 All icons generated!');
}

generateIcons().catch(console.error);
