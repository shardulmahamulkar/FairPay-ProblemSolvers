import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.join(__dirname, '..');
const serverUpdatesDir = path.join(clientDir, '../server/updates');
const distDir = path.join(clientDir, 'dist');
const zipPath = path.join(serverUpdatesDir, 'dist.zip');
const metadataPath = path.join(serverUpdatesDir, 'metadata.json');

console.log('🔄 Step 1: Building a fresh production client...');
execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });

if (!fs.existsSync(serverUpdatesDir)) {
    fs.mkdirSync(serverUpdatesDir, { recursive: true });
}

console.log(`\n📦 Step 2: Zipping the build into ${zipPath}...`);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    console.log(`✅ Successfully created dist.zip (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);

    console.log('\n📝 Step 3: Updating metadata version...');
    let metadata = { version: '1.0.0' };
    if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    }

    // Bump the patch version string (e.g. 1.0.0 -> 1.0.1)
    const parts = metadata.version.split('.');
    parts[2] = parseInt(parts[2]) + 1;
    metadata.version = parts.join('.');

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`🚀 SUCCESS! OTA Update version bumped to ${metadata.version}!`);
    console.log('📱 The next time someone opens the Android app, they will automatically download this update.');
});

archive.on('error', (err) => {
    console.error("❌ Archiving failed:");
    throw err;
});

archive.pipe(output);
// Put the contents of 'dist' inside the zip
archive.directory(distDir, false);
archive.finalize();
