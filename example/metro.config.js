const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const libraryRoot = path.resolve(__dirname, '..');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [libraryRoot],
  resolver: {
    extraNodeModules: { '@makit-kit/react-native-pdf': libraryRoot },
    nodeModulesPaths: [path.join(__dirname, 'node_modules'), path.join(libraryRoot, 'node_modules')],
  },
});
