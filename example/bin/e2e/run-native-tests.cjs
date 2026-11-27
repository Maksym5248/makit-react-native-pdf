const { spawnSync } = require('node:child_process');
const path = require('node:path');
const example = path.resolve(__dirname, '../..');
const platform = process.argv[2];
const selected = process.argv[3];
function run(command, args, cwd = example, capture = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.status}`);
  return result.stdout;
}
if (platform === 'ios') {
  const inventory = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], example, true));
  const device = Object.values(inventory.devices).flat().find(item => item.name === 'Ammo-E2E' && (!selected || item.udid === selected));
  if (!device) throw new Error('Existing Ammo-E2E simulator required; no device will be created.');
  run('xcodebuild', ['test', '-workspace', 'PdfReaderExample.xcworkspace', '-scheme', 'PdfReaderExample',
    '-configuration', 'Debug', '-sdk', 'iphonesimulator', '-destination', `platform=iOS Simulator,id=${device.udid}`,
    '-derivedDataPath', 'build/example-simulator', '-only-testing:PdfReaderExampleUITests', '-parallel-testing-enabled', 'NO'], path.join(example, 'ios'));
} else if (platform === 'android') {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const adb = sdk ? path.join(sdk, 'platform-tools/adb') : 'adb';
  const serials = run(adb, ['devices'], example, true).split('\n').filter(line => /\tdevice$/.test(line)).map(line => line.split('\t')[0]);
  const device = serials.find(serial => serial.startsWith('emulator-') && (!selected || selected === serial) && run(adb, ['-s', serial, 'emu', 'avd', 'name'], example, true).split(/\r?\n/)[0] === 'Ammo_E2E');
  if (!device) throw new Error('Start the existing Ammo_E2E emulator first; no device will be created.');
  const architecture = run(adb, ['-s', device, 'shell', 'getprop', 'ro.product.cpu.abi'], example, true).trim();
  run('./gradlew', [':app:assembleDebug', ':app:assembleDebugAndroidTest', `-PreactNativeArchitectures=${architecture}`], path.join(example, 'android'));
  for (const apk of ['debug/app-debug.apk', 'androidTest/debug/app-debug-androidTest.apk']) {
    run(adb, ['-s', device, 'install', '-r', path.join(example, 'android/app/build/outputs/apk', apk)]);
  }
  run(adb, ['-s', device, 'reverse', 'tcp:8081', 'tcp:8081']);
  const report = run(adb, ['-s', device, 'shell', 'am', 'instrument', '-w', '-r', 'com.pdfreaderexample.test/androidx.test.runner.AndroidJUnitRunner'], example, true);
  process.stdout.write(report);
  // am instrument may return shell exit code 0 for a failed test or a crashed process.
  if (!/OK \(\d+ tests?\)/.test(report) || /FAILURES|Process crashed/.test(report)) process.exitCode = 1;
} else {
  throw new Error('Usage: node bin/e2e/run-native-tests.cjs ios|android [existing-device-id]');
}
