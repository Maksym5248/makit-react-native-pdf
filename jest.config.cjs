module.exports = {
    rootDir: '.',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    testMatch: ['<rootDir>/test/*.test.js'],
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
        '\\.css$': '<rootDir>/test/empty.cjs',
        '^react-native$': '<rootDir>/test/react-native.cjs',
        '^@makit-kit/react-native-pdf$': '<rootDir>/src/index.ts',
    },
};
