"""Numeric-only benchmark. Open Compare renderers → Scroll package/baseline first."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('serial')
parser.add_argument('backend', choices=['package', 'baseline'])
parser.add_argument('pages', type=int)
parser.add_argument('output', type=Path)
args = parser.parse_args()
sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
adb = str(Path(sdk) / 'platform-tools/adb') if sdk else 'adb'
if not args.serial.startswith('emulator-'):
    raise SystemExit('An existing emulator is required.')
name = subprocess.check_output([adb, '-s', args.serial, 'emu', 'avd', 'name'], text=True).splitlines()[0]
if name != 'Ammo_E2E':
    raise SystemExit('Use the existing Ammo_E2E emulator.')


def run(*commands):
    return subprocess.check_output([adb, '-s', args.serial, 'shell', *commands], text=True)


def memory():
    output = run('dumpsys', 'meminfo', 'com.pdfreaderexample')
    return {key: int(value) for key, value in re.findall(r'(TOTAL PSS|TOTAL RSS|TOTAL SWAP PSS):\s*(\d+)', output)}


width, height = map(int, re.findall(r'(\d+)x(\d+)', run('wm', 'size'))[-1])
x, top, bottom = str(width // 2), str(int(height * .25)), str(int(height * .79))
before = memory()
run('dumpsys', 'gfxinfo', 'com.pdfreaderexample', 'reset')
started = time.monotonic()
for direction in [1, -1]:
    for _ in range(10):
        points = [x, bottom, x, top] if direction == 1 else [x, top, x, bottom]
        run('input', 'swipe', *points, '180')
raw = run('dumpsys', 'gfxinfo', 'com.pdfreaderexample')
metrics = {}
for line in raw.splitlines():
    match = re.match(r'\s*(Total frames rendered|Janky frames|50th percentile|90th percentile|95th percentile|99th percentile|Number Missed Vsync|Number High input latency|Number Slow UI thread|Number Slow bitmap uploads|Number Slow issue draw commands|Number Frame deadline missed):\s*(.*)', line)
    if match:
        metrics[match.group(1)] = match.group(2)
if int(metrics.get('Total frames rendered', '0')) == 0:
    raise SystemExit('No rendered frames: open the intended renderer and retry. No report saved.')
report = {
    'platform': 'Android emulator',
    'mode': 'debug',
    'backend': args.backend,
    'pages': args.pages,
    'workload': '10 upward + 10 downward swipes, 180ms each',
    'elapsedSeconds': time.monotonic() - started,
    'memoryKiBBefore': before,
    'memoryKiBAfter': memory(),
    'gfxinfo': metrics,
}
args.output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
