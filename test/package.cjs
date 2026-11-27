const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('npm tarball includes runtime, types, native plugin and fixes only', () => {
  const root = path.resolve(__dirname, '..');
  const result = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json', '--cache', '/tmp/pdf-reader-npm-cache'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const files = JSON.parse(result.stdout)[0].files.map(file => file.path);
  for (const name of ['lib/module/index.js', 'lib/module/index.web.js', 'lib/types/index.d.ts', 'app.plugin.js', 'LocalPdfReader.podspec', 'LICENSE', 'NOTICE', 'scripts/apply-web-patches.cjs', 'patches/react-pdf+9.2.1.patch', 'patches/pdfjs-dist+4.8.69.patch']) assert.ok(files.includes(name), name);
  assert.ok(files.some(name => name.startsWith('ios/')));
  assert.ok(files.some(name => name.startsWith('android/src/')));
  assert.ok(files.some(name => name.startsWith('src/native/')));
  assert.ok(files.every(name => !/(^|\/)(node_modules|example|example-expo|site|site-dist|test|Pods|build|\.git|\.env)(\/|$)/.test(name)), files.join('\n'));
});
