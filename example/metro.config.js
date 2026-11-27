const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const workspaceRoot = path.resolve(__dirname, '../../..');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [workspaceRoot, fs.realpathSync(path.join(workspaceRoot, 'node_modules'))],
  resolver: {
    extraNodeModules: { '@maksym5248/react-native-pdf-reader': path.resolve(__dirname, '..') },
    nodeModulesPaths: [fs.realpathSync(path.join(workspaceRoot, 'node_modules')), path.join(__dirname, 'node_modules'), path.join(workspaceRoot, 'node_modules')],
  },
});
