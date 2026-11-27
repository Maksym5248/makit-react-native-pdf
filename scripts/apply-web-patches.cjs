const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
for (const [name, version] of [['react-pdf', '9.2.1'], ['pdfjs-dist', '4.8.69']]) {
  let manifest;
  try { manifest = require.resolve(`${name}/package.json`, { paths: [process.cwd()] }); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    throw new Error(`Install ${name}@${version} in the consuming application before applying Web patches.`);
  }
  const installed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (installed.version !== version) throw new Error(`Web patches require ${name}@${version}; found ${installed.version}.`);
  const dependencyRoot = path.dirname(manifest);
  const patchFile = path.join(packageRoot, 'patches', `${name}+${version}.patch`);
  // Strip a/node_modules/<package>/ so this also works with nested/hoisted installs.
  const args = ['--batch', '--silent', '-p3', '-d', dependencyRoot, '-i', patchFile];
  const applied = spawnSync('patch', [...args, '--forward', '--dry-run'], { encoding: 'utf8' });
  if (applied.status === 0) {
    const result = spawnSync('patch', [...args, '--forward'], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`Could not patch ${name}.`);
    console.log(`Applied local Web patch: ${name}@${version}`);
    continue;
  }
  const reversed = spawnSync('patch', [...args, '--reverse', '--dry-run'], { encoding: 'utf8' });
  if (reversed.status !== 0) throw new Error(`Unexpected ${name} sources; inspect ${patchFile}. No patch was applied.`);
  console.log(`Local Web patch already present: ${name}@${version}`);
}
