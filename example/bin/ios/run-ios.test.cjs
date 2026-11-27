const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

function load(name, mocks, argv = []) {
    const module = { exports: {} };
    const requireMock = id => mocks[id] ?? require(id);
    requireMock.resolve = require.resolve;
    runInNewContext(readFileSync(resolve(__dirname, name), 'utf8'), {
        module,
        require: requireMock,
        __dirname,
        process: { platform: 'darwin', argv: ['node', name, ...argv], env: {} },
        console: { log() {} },
        setTimeout,
    });
    return module.exports;
}

function simulatorFixture(devices, hasApp = true) {
    const calls = [];
    const api = load('open-simulator.cjs', {
        'node:fs': { existsSync: path => (hasApp ? path.endsWith('/Simulator.app') : path.endsWith('/DeviceHub.app')) },
        'node:child_process': {
            execFileSync(command, args) {
                calls.push([command, Array.from(args)]);
                if (command === 'xcode-select') return '/Applications/Xcode.app/Contents/Developer';
                if (args[1] === 'list') return JSON.stringify({ devices });
                return '';
            },
        },
    });
    return { api, calls };
}

const device = { name: 'iPhone 18 Pro', udid: 'manual-device', isAvailable: true, state: 'Booted' };

test('reuses the booted owner device instead of a newer shutdown device', () => {
    const { api } = simulatorFixture({
        'com.apple.CoreSimulator.SimRuntime.iOS-27-1': [{ ...device, udid: 'newer', state: 'Shutdown' }],
        'com.apple.CoreSimulator.SimRuntime.iOS-27-0': [device],
    });
    assert.equal(api.selectSimulator().device.udid, device.udid);
    assert.equal(api.selectSimulator('newer').device.udid, 'newer');
});

test('opens DeviceHub when Simulator is absent, without rebooting or using legacy arguments', () => {
    const { api, calls } = simulatorFixture({ 'com.apple.CoreSimulator.SimRuntime.iOS-27-0': [device] }, false);
    api.openSimulator(api.selectSimulator());
    const openCall = calls.find(([cmd]) => cmd === 'open');
    assert.deepEqual(openCall, ['open', ['/Applications/Xcode.app/Contents/Applications/DeviceHub.app']]);
    assert.ok(!calls.some(([, args]) => args.includes('boot')));
});

test('does not create or boot another device when the requested simulator is absent', () => {
    const { api, calls } = simulatorFixture({});
    assert.throws(() => api.selectSimulator('Missing'), /No available iOS simulator/);
    assert.equal(calls.length, 2);
});

function launchFixture({ failBuild = false, packager = { status: 'running', root: resolve(__dirname, '../..') } } = {}) {
    const calls = [];
    const { main } = load('run-ios.cjs', {
        './open-simulator.cjs': {
            selectSimulator: () => ({ device }),
            openSimulator: () => calls.push(['open']),
        },
        '@react-native-community/cli-tools': { isPackagerRunning: async () => packager },
        'node:child_process': {
            execFileSync(command, args) {
                calls.push([command, Array.from(args)]);
                if (command === 'xcodebuild' && failBuild) throw new Error('Build failed');
                return command.includes('PlistBuddy') ? 'org.reactjs.native.example.PdfReaderExample\n' : '';
            },
        },
    }, [device.name]);
    return { main, calls };
}

test('builds the standalone example and installs/launches it on the selected device', async () => {
    const { main, calls } = launchFixture();
    await main();
    const build = calls.find(([command]) => command === 'xcodebuild')[1];
    assert.equal(build[build.indexOf('-workspace') + 1], 'PdfReaderExample.xcworkspace');
    assert.equal(build[build.indexOf('-scheme') + 1], 'PdfReaderExample');
    assert.ok(build.includes('platform=iOS Simulator,id=manual-device'));
    assert.ok(calls.some(([command, args]) => command === 'xcrun' && args[1] === 'install' && args[2] === device.udid));
    assert.ok(calls.some(([command, args]) => command === 'xcrun' && args[1] === 'launch' && args.includes('org.reactjs.native.example.PdfReaderExample')));
});

test('never installs a stale app after a failed build', async () => {
    const { main, calls } = launchFixture({ failBuild: true });
    await assert.rejects(main(), /Build failed/);
    assert.ok(!calls.some(([command]) => command === 'xcrun'));
});

test('requires the example Metro without opening another Terminal or stopping another project', async () => {
    for (const packager of ['not_running', 'unrecognized', { status: 'running', root: '/another/project' }]) {
        const { main, calls } = launchFixture({ packager });
        await assert.rejects(main(), /Metro|another process/);
        assert.equal(calls.length, 0);
    }
});
