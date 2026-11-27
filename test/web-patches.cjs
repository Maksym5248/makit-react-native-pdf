const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = [
  path.join(path.dirname(require.resolve('react-pdf/package.json')), 'src/Page/TextLayer.tsx'),
  path.join(path.dirname(require.resolve('react-pdf/package.json')), 'dist/esm/Page/TextLayer.js'),
  path.join(path.dirname(require.resolve('react-pdf/package.json')), 'dist/cjs/Page/TextLayer.js'),
  path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build/pdf.mjs'),
];
function apply() {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/apply-web-patches.cjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
function hashes() { return files.map(file => createHash('sha256').update(readFileSync(file)).digest('hex')); }

test('supplied Web fixes are present and repeated application does not reverse them', () => {
  apply();
  for (const file of files.slice(0, 3)) {
    assert.match(readFileSync(file, 'utf8'), /let cancelled = false/);
    assert.match(readFileSync(file, 'utf8'), /if \(cancelled\) return/);
  }
  assert.match(readFileSync(files[3], 'utf8'), /filter\(Boolean\)\.map/);
  const once = hashes();
  apply();
  assert.deepEqual(hashes(), once);
});
