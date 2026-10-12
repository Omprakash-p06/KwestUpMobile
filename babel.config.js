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

  // SDK 57 / Reanimated 4: the worklets Babel plugin is configured automatically by
  // babel-preset-expo — Expo docs: "No additional configuration is required. Reanimated Babel
  // plugin is automatically configured in babel-preset-expo when you install the library."
  // The previous explicit 'react-native-reanimated/plugin' entry was removed: Reanimated 4 moved
  // the plugin to react-native-worklets/plugin (per the official 3.x -> 4.x migration guide), so
  // listing the old path manually is redundant and misleading.

  // Stryker Instrumenter isolation: Stryker's Babel parser defines its own decorators,
  // which conflicts with babel-preset-expo's decorators-legacy plugin. When invoked by
  // the Stryker instrumentation process (outside babel-jest / metro), return bare presets.
  const isBabelWorker =
    api &&
    typeof api.caller === 'function' &&
    api.caller((c) => c && (c.name === 'babel-jest' || c.name === 'metro'));
  const isStrykerInstrumenter =
    !isBabelWorker &&
    (process.env.STRYKER === 'true' ||
      (Array.isArray(process.argv) &&
        process.argv.some((a) => typeof a === 'string' && a.includes('stryker'))));

  if (isStrykerInstrumenter) {
    return {
      presets: [],
      plugins: [],
    };
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};