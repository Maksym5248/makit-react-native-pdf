const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { marked } = require('marked');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'site-dist');
const patched = spawnSync(process.execPath, [path.join(root, 'scripts/apply-web-patches.cjs')], { cwd: root, stdio: 'inherit' });
if (patched.status !== 0) process.exit(patched.status || 1);
const build = spawnSync(process.execPath, [require.resolve('webpack-cli/bin/cli.js'), '--config', 'webpack.config.cjs', '--mode', 'production'], { cwd: path.join(root, 'example'), stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(path.join(root, 'site'), output, { recursive: true });
fs.cpSync(path.join(root, 'example/dist'), path.join(output, 'demo'), { recursive: true });
fs.mkdirSync(path.join(output, 'docs'), { recursive: true });
const pages = [['index', 'README.md', 'Overview'], ['api', 'docs/api.md', 'API reference'], ['expo', 'docs/expo.md', 'Expo setup'], ['parity', 'docs/parity.md', 'Platform parity'], ['contributing', 'CONTRIBUTING.md', 'Development']];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const targets = new Map(pages.map(([slug, source]) => [source, slug + '.html']));
for (const [slug, source, title] of pages) {
  const renderer = new marked.Renderer();
  renderer.link = ({ href, text }) => {
    const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(source), href));
    const target = targets.get(normalized) || (normalized === 'example/README.md' ? '../demo/' : normalized === 'LICENSE' || normalized === 'NOTICE' ? '../' + normalized : href);
    return `<a href="${escape(target)}">${text}</a>`;
  };
  renderer.image = ({ href, text }) => {
    const asset = href.replace('https://raw.githubusercontent.com/Maksym5248/makit-react-native-pdf/main/site/screenshots/', '../screenshots/');
    return `<img src="${escape(asset)}" alt="${escape(text)}">`;
  };
  const content = marked.parse(fs.readFileSync(path.join(root, source), 'utf8'), { renderer });
  const nav = pages.map(([id, , label]) => `<a href="./${id}.html" ${id === slug ? 'aria-current="page"' : ''}>${label}</a>`).join('');
  fs.writeFileSync(path.join(output, 'docs', slug + '.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Makit PDF Reader</title><link rel="stylesheet" href="../style.css"><link rel="icon" href="../icon.svg" type="image/svg+xml"></head><body><header><nav class="nav" aria-label="Main navigation"><a class="brand" href="../">makit<span>PDF reader</span></a><div class="links"><a href="./">Documentation</a><a href="../demo/">Playground</a><a href="../">Home</a></div></nav></header><main class="wrap docs-layout"><nav class="sidebar" aria-label="Documentation">${nav}</nav><article class="doc">${content}</article></main></body></html>`);
}
for (const file of ['LICENSE', 'NOTICE']) fs.copyFileSync(path.join(root, file), path.join(output, file));
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Static website, docs and playground built:', output);
