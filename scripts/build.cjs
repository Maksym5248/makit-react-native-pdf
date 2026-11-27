const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'lib');
fs.rmSync(output, { recursive: true, force: true });
function compile(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const source = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            compile(source);
            continue;
        }
        const relative = path.relative(path.join(root, 'src'), source);
        if (source.endsWith('.d.ts')) {
            const declaration = path.join(output, 'types', relative);
            fs.mkdirSync(path.dirname(declaration), { recursive: true });
            fs.copyFileSync(source, declaration);
            continue;
        }
        if (!/\.[jt]sx?$/.test(source)) continue;
        const target = path.join(output, 'module', relative.replace(/\.[jt]sx?$/, '.js'));
        let code = fs.readFileSync(source, 'utf8');
        // The published worker is JavaScript; the source worker remains TypeScript for Metro/Webpack development.
        code = code.replace("new URL('./search.worker.ts', import.meta.url)", "new URL('./search.worker.js', import.meta.url)");
        const result = babel.transformSync(code, {
            filename: source,
            babelrc: false,
            configFile: false,
            plugins: source.endsWith('.js') ? ['@babel/plugin-transform-flow-strip-types'] : [],
            presets: source.endsWith('.js')
                ? []
                : [
                      ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
                      ['@babel/preset-react', { runtime: 'automatic' }],
                  ],
        });
        if (!result || !result.code) throw new Error(`No output for ${relative}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, result.code + '\n');
    }
}
compile(path.join(root, 'src'));
fs.writeFileSync(
    path.join(output, 'module/index.web.js'),
    fs
        .readFileSync(path.join(output, 'module/index.js'), 'utf8')
        .replace("'./pdf-reader'", "'./pdf-reader.web'")
        .replace("'./search'", "'./search.web'"),
);
const types = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.build.json')], {
    stdio: 'inherit',
});
if (types.status !== 0) process.exit(types.status || 1);
console.log('Built ESM, local web workers and declarations. Native Codegen sources remain in src/native.');
