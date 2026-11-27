module.exports = {
    parserOptions: { tsconfigRootDir: __dirname },
    extends: [
        '../shared/config/eslint-config-base.js',
        '../shared-client/config/eslint-config-client.js',
        '../shared/config/eslint-config-prettier.js',
    ],
    ignorePatterns: ['src/native/*.js', 'src/native/*.d.ts'],
    rules: {
        'react/prop-types': 0,
        'import/namespace': 0,
        'import/default': 0,
        'import/no-named-as-default-member': 0,
    },
    overrides: [{ files: ['src/native/Native*.ts'], rules: { 'import/no-default-export': 0 } }, { files: ['src/pdf-reader.tsx'], rules: { 'import/no-named-as-default': 0 } }],
};
