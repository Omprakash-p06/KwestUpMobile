module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 2021,
    sourceType: 'module',
    babelOptions: {
      configFile: './babel.config.js',
    },
  },
  plugins: ['react', 'react-native', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  env: {
    'react-native/react-native': true,
    es6: true,
    node: true,
    jest: true,
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react-native/no-unused-styles': 'warn',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-raw-text': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
  },
  ignorePatterns: ['node_modules/', '.expo/', 'dist/', 'web-build/', 'android/', 'ios/'],
};
