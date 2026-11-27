module.exports = {
    root: true,
    extends: ['@react-native'],
    ignorePatterns: ['src/native/*.js', 'src/native/*.d.ts'],
    rules: { 'prettier/prettier': 'off', 'react/no-unstable-nested-components': 'off' },
    overrides: [{ files: ['src/**/*.web.ts', 'src/**/*.web.tsx', 'src/search.worker.ts'], env: { browser: true, worker: true } }],
};
