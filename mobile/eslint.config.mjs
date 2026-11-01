import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.expo/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-react': 'error', // dự án mobile vẫn viết `import React`
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^(_|React$)', caughtErrors: 'none' }],
    },
  },
  {
    files: ['jest.setup.js', '**/__tests__/**', '**/*.test.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    files: ['babel.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
];
