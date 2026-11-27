const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const libraryRoot = path.resolve(__dirname, '..');
// The library is the workspace root itself, so it must be in Metro's file map.
config.watchFolders = [...config.watchFolders, libraryRoot];
config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(libraryRoot, 'node_modules'),
];
module.exports = config;
