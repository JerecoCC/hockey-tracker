import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import prettierConfig from 'eslint-config-prettier'

const sharedRules = {
  ...js.configs.recommended.rules,
  ...react.configs.recommended.rules,
  ...react.configs['jsx-runtime'].rules,
  ...reactHooks.configs.recommended.rules,
  'react/jsx-no-target-blank': 'off',
  'react-refresh/only-export-components': [
    'warn',
    { allowConstantExport: true },
  ],
  // Formatting enforced by Prettier — kept here as documentation only;
  // eslint-config-prettier disables the ESLint versions to avoid conflicts.
  'react/jsx-first-prop-new-line': 'off',
  'react/jsx-max-props-per-line': 'off',
  'react/jsx-closing-bracket-location': 'off',
}

const sharedPlugins = {
  react,
  'react-hooks': reactHooks,
  'react-refresh': reactRefresh,
}

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: sharedPlugins,
    rules: { ...sharedRules, ...prettierConfig.rules },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
      globals: globals.browser,
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      ...sharedPlugins,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...sharedRules,
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
    },
  },
]
