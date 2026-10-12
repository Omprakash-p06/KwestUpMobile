const expoAndroidPreset = require('jest-expo/android/jest-preset.js');

module.exports = {
  preset: 'jest-expo/android',
  setupFiles: [
    ...expoAndroidPreset.setupFiles,
    '<rootDir>/__tests__/setup/jest.setup.js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-paper|react-native-vector-icons|react-native-modal|react-native-confetti-cannon|llama.rn|react-native-android-widget)',
  ],
  moduleFileExtensions: [
    'android.js',
    'android.jsx',
    'android.ts',
    'android.tsx',
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
    'node',
  ],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.styles.js',
    '!**/node_modules/**',
  ],
  // CR-09: ratchet gate. The floor is set just below the current measured
  // coverage (statements 49.6% / branches 40.8% / functions 37.2% / lines
  // 52.9% across 30 suites, 457 tests on 2026-10-12) so coverage cannot
  // silently regress. Raise toward the §24 targets (70/90/95) as engine
  // suites land; do not lower these numbers.
  coverageThreshold: {
    global: {
      statements: 47,
      branches: 38,
      functions: 35,
      lines: 50,
    },
  },
  watchPlugins: [],
};
