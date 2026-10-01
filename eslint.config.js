const babelParser = require('@babel/eslint-parser');
const reactPlugin = require('eslint-plugin-react');
const reactNativePlugin = require('eslint-plugin-react-native');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'android/**', 'ios/**', 'assets/**', 'KwestUpPC/**', 'coverage/**', 'eslint-report.json'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2021,
        sourceType: 'module',
        babelOptions: {
          configFile: './babel.config.js',
        },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-native': reactNativePlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react-native/no-unused-styles': 'warn',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-raw-text': 'off',
      'react-native/no-color-literals': 'warn',
      'react-native/sort-styles': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // WR-09 partial: stays 'warn' until the ~100 pre-existing console
      // statements are triaged. Escalating to 'error' now reds the gate
      // (verified 2026-10-01). Phased enforcement tracked pre-Phase 22.
      'no-console': 'warn',
    },
  },
  {
    files: ['__tests__/**/*.{js,jsx}', '*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
