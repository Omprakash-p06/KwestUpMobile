module.exports = function (api) {
  // WR-01: cache keyed on NODE_ENV (not `api.cache(true)`) so a long-lived
  // Metro/babel daemon never serves a config evaluated for the wrong env —
  // the plugin list below branches on NODE_ENV, so the cache must vary on it.
  // Guarded for direct invocation in tests with a stubbed `api` object.
  if (api && api.cache && typeof api.cache.using === 'function') {
    api.cache.using(() => process.env.NODE_ENV);
  } else if (api && typeof api.cache === 'function') {
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