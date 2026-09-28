module.exports = function (api) {
  if (api && typeof api.cache === 'function') {
    api.cache(true);
  }

  const plugins = [];

  // OBS-01: Strip console.log/info/debug in production bundles while preserving error and warn
  if (process.env.NODE_ENV === 'production') {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  // react-native-reanimated/plugin must always be listed last
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};