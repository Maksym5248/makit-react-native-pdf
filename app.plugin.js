const { createRunOncePlugin, withGradleProperties } = require('expo/config-plugins');
const { name, version } = require('./package.json');

function withPdfReader(config) {
  // Expo autolinking reads this property when configuring Maven repositories.
  // Merge at the mod boundary so an application's existing repositories survive.
  return withGradleProperties(config, config => {
    const key = 'android.extraMavenRepos';
    const property = config.modResults.find(item => item.type === 'property' && item.key === key);
    const repositories = property ? JSON.parse(property.value) : [];
    if (!Array.isArray(repositories)) throw new Error(`${key} must contain a JSON array.`);
    if (!repositories.some(repository => repository?.url === 'https://jitpack.io' || repository?.url === 'https://jitpack.io/')) {
      repositories.push({ url: 'https://jitpack.io' });
    }
    if (property) property.value = JSON.stringify(repositories);
    else config.modResults.push({ type: 'property', key, value: JSON.stringify(repositories) });
    return config;
  });
}

module.exports = createRunOncePlugin(withPdfReader, name, version);
