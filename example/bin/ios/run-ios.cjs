const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const { isPackagerRunning } = require('@react-native-community/cli-tools');

const { selectSimulator, openSimulator } = require('./open-simulator.cjs');

const root = resolve(__dirname, '../..');

async function main() {
    const [requested, ...extra] = process.argv.slice(2);
    if (process.argv.includes('--help')) {
        console.log('Usage: yarn workspace pdf-reader-example ios [device-name-or-UDID]');
        console.log('Uses the currently booted iOS simulator by default; pass a name or UDID to select another.');
        return;
    }
    if (extra.length || requested?.startsWith('-')) {
        throw new Error('Usage: yarn workspace pdf-reader-example ios [device-name-or-UDID]');
    }

    const simulator = selectSimulator(requested);
    const port = 8081;
    const packager = await isPackagerRunning(port);
    if (packager === 'unrecognized' || (packager !== 'not_running' && resolve(packager.root) !== root)) {
        throw new Error('Port 8081 belongs to another process or Metro project. Stop it before launching PdfReaderExample.');
    }

    if (packager === 'not_running') throw new Error('Start Metro first: yarn workspace pdf-reader-example start');

    openSimulator(simulator);
    const derivedData = resolve(root, 'ios/build/example-simulator');
    const options = { cwd: resolve(root, 'ios'), stdio: 'inherit' };
    execFileSync(
        'xcodebuild',
        [
            '-workspace',
            'PdfReaderExample.xcworkspace',
            '-scheme',
            'PdfReaderExample',
            '-configuration',
            'Debug',
            '-sdk',
            'iphonesimulator',
            '-destination',
            `platform=iOS Simulator,id=${simulator.device.udid}`,
            '-derivedDataPath',
            derivedData,
            'build',
        ],
        options,
    );

    const app = resolve(derivedData, 'Build/Products/Debug-iphonesimulator/PdfReaderExample.app');
    const bundleId = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', resolve(app, 'Info.plist')], {
        encoding: 'utf8',
    }).trim();
    if (!bundleId) throw new Error('The built example app has no bundle identifier.');
    execFileSync('xcrun', ['simctl', 'install', simulator.device.udid, app], options);

    execFileSync('xcrun', ['simctl', 'launch', '--terminate-running-process', simulator.device.udid, bundleId], options);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = { main };
