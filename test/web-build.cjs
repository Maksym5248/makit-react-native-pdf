const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const webpack = require('webpack');

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ammo-pdf-web-'));
webpack({
    mode: 'development',
    target: 'web',
    entry: path.resolve(__dirname, '../src/pdf-reader.web.tsx'),
    output: { path: output, filename: 'reader.js', publicPath: 'auto' },
    resolve: { extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.js'], alias: { 'react-native$': require.resolve('react-native-web') } },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { configFile: false, babelrc: false, presets: [['@babel/preset-env', { modules: false }], '@babel/preset-typescript', '@babel/preset-react'] } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
}, (error, stats) => {
    if (error || stats.hasErrors()) {
        console.error(error || stats.toString({ all: false, errors: true }));
        process.exitCode = 1;
        return;
    }
    const assets = stats.toJson({ all: false, assets: true }).assets.map(asset => asset.name);
    if (!assets.some(name => name.endsWith('.mjs'))) {
        console.error('PDF worker was not bundled');
        process.exitCode = 1;
        return;
    }
    console.log('Web reader and local PDF worker compiled:', output);
});
