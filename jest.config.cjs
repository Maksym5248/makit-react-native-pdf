module.exports = {
    rootDir: '../..',
    roots: ['<rootDir>/packages/pdf-reader/src', '<rootDir>/packages/pdf-reader/test'],
    testMatch: ['<rootDir>/packages/pdf-reader/test/*.test.js'],
    testEnvironment: 'node',
    watchman: false,
    transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', {
            babelrc: false,
            configFile: false,
            presets: ['@babel/preset-env', '@babel/preset-typescript', '@babel/preset-react'],
            plugins: [require.resolve('./test/import-meta.cjs')],
        }],
    },
    moduleNameMapper: {
        '\\.css$': '<rootDir>/packages/pdf-reader/test/empty.cjs',
        '^react-native$': '<rootDir>/packages/pdf-reader/test/react-native.cjs',
        '^@maksym5248/react-native-pdf-reader$': '<rootDir>/packages/pdf-reader/src/index.ts',
    },
};
