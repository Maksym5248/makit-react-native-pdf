const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = {
  mode: 'development',
  context: __dirname,
  entry: './src/index.web.tsx',
  output: { path: path.join(__dirname, 'dist'), filename: 'example.js', clean: true },
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    alias: {
      'react-native$': require.resolve('react-native-web'),
      '@makit-kit/react-native-pdf$': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  module: { rules: [
    { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { configFile: false, babelrc: false, presets: [['@babel/preset-env', { modules: false }], '@babel/preset-typescript', '@babel/preset-react'] } } },
    { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
  ] },
  plugins: [new HtmlWebpackPlugin({ templateContent: '<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Makit · PDF Playground</title><style>html,body,#root{height:100%;margin:0}#root{display:flex}</style></head><body><div id="root"></div></body></html>' })],
  devServer: { host: '127.0.0.1', port: 8093, open: false },
};
