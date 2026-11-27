const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

if (process.platform !== 'darwin') {
    throw new Error('iOS geometry checks require macOS and the Xcode command line tools');
}

const directory = mkdtempSync(join(tmpdir(), 'ammo-pdf-geometry-'));
try {
    const executable = join(directory, 'geometry-test');
    execFileSync('xcrun', ['clang++', '-std=c++17', '-framework', 'CoreGraphics',
        join(__dirname, 'ios-geometry.mm'), '-o', executable], { stdio: 'inherit' });
    execFileSync(executable, [], { stdio: 'inherit' });
    process.stdout.write('PASS: native PDF highlight geometry\n');
} finally {
    rmSync(directory, { recursive: true, force: true });
}
