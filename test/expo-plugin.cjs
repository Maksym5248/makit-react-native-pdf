const test = require('node:test');
const assert = require('node:assert/strict');
const { compileModsAsync } = require('expo/config-plugins');
const plugin = require('../app.plugin');

async function evaluate(config) {
  const configured = plugin(config);
  return compileModsAsync(configured, { projectRoot: process.cwd(), platforms: ['android'], introspect: true });
}

test('Expo plugin configures JitPack without adding Android file permissions', async () => {
  const result = await evaluate({ name: 'Test', slug: 'test' });
  const baseline = await compileModsAsync({ name: 'Test', slug: 'test' }, { projectRoot: process.cwd(), platforms: ['android'], introspect: true });
  const properties = result._internal.modResults.android.gradleProperties.filter(item => item.key === 'android.extraMavenRepos');
  assert.equal(properties.length, 1);
  assert.deepEqual(JSON.parse(properties[0].value), [{ url: 'https://jitpack.io' }]);
  assert.deepEqual(result._internal.modResults.android.manifest, baseline._internal.modResults.android.manifest);
});

test('Expo plugin is idempotent and preserves application config', async () => {
  const config = { name: 'Test', slug: 'test', ios: { bundleIdentifier: 'dev.test.reader' }, android: { package: 'dev.test.reader', permissions: ['CAMERA'] } };
  const once = plugin(config);
  const twice = plugin(once);
  assert.deepEqual(twice, once);
  assert.equal(twice.ios.bundleIdentifier, 'dev.test.reader');
  assert.deepEqual(twice.android.permissions, ['CAMERA']);
});

test('Expo plugin retains repositories configured by the application', async () => {
  const { withBuildProperties } = require('expo-build-properties');
  const existing = withBuildProperties({ name: 'Test', slug: 'test' }, {
    android: { extraMavenRepos: [{ url: 'https://maven.example.test' }] },
  });
  const result = await evaluate(existing);
  const property = result._internal.modResults.android.gradleProperties.find(item => item.key === 'android.extraMavenRepos');
  const repositories = JSON.parse(property.value);
  assert.equal(repositories.length, 2);
  assert.deepEqual(new Set(repositories.map(repository => repository.url)), new Set(['https://maven.example.test', 'https://jitpack.io']));
});
