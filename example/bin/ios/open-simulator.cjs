// Simulator selection and launch shared by the dev build and standalone launcher.
const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

function run(command, args) {
    return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function selectSimulator(requested) {
    if (process.platform !== 'darwin') throw new Error('iOS Simulator requires macOS and Xcode.');
    const developerDir = run('xcode-select', ['-p']);
    const simulatorApplication = [
        resolve(developerDir, 'Applications/Simulator.app'),
        resolve(developerDir, '../Applications/Simulator.app'),
    ].find(existsSync);

    const deviceHubApplication = [
        resolve(developerDir, '../Applications/DeviceHub.app'),
        resolve(developerDir, 'Applications/DeviceHub.app'),
    ].find(existsSync);
    if (!simulatorApplication && !deviceHubApplication) {
        throw new Error('Neither Simulator.app nor DeviceHub.app was found in the selected Xcode.');
    }

    const { devices } = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']));
    const matches = Object.entries(devices)
        .filter(([runtime]) => runtime.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-'))
        .sort(([left], [right]) => right.localeCompare(left, 'en', { numeric: true }))
        .flatMap(([, entries]) => entries)
        .filter(
            device =>
                device.isAvailable && (requested ? device.udid === requested || device.name === requested : device.state === 'Booted'),
        );
    if (!requested && matches.length !== 1) {
        throw new Error('Specify a simulator name or UDID: exactly one iOS simulator must be booted when no parameter is given.');
    }
    const device = matches.find(candidate => candidate.state === 'Booted') || matches[0];
    if (!device) throw new Error(`No available iOS simulator matches "${requested}". Run: xcrun simctl list devices available`);

    return { device, simulatorApplication, deviceHubApplication };
}

function openSimulator({ device, simulatorApplication, deviceHubApplication }) {
    if (device.state !== 'Booted') run('xcrun', ['simctl', 'boot', device.udid]);
    if (simulatorApplication) {
        run('open', [simulatorApplication, '--args', '-CurrentDeviceUDID', device.udid]);
    } else {
        run('open', [deviceHubApplication]);
        console.log(`DeviceHub opened. If the device window is not visible, open ${device.name} (${device.udid}) there.`);
    }
    execFileSync('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], { stdio: 'inherit' });
    console.log(`Simulator ready: ${device.name} (${device.udid})`);
}

module.exports = { selectSimulator, openSimulator };

if (require.main === module) {
    try {
        if (process.argv.length > 3) throw new Error('Usage: yarn workspace pdf-reader-example ios:simulator [device-name-or-UDID]');
        openSimulator(selectSimulator(process.argv[2]));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
