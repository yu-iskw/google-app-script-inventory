import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';
import vitestPlugin from '@vitest/eslint-plugin';

/** @type {import("@typescript-eslint/parser").ParserOptions} */
const tsParserOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
  projectService: true,
  tsconfigRootDir: import.meta.dirname,
};

/**
 * Shared production + test rules (AI agent feedback).
 * Cyclomatic: only SonarJS (core `complexity` removed — duplicated sonarjs/cyclomatic-complexity).
 * Cognitive: sonarjs/cognitive-complexity (primary “hard to change” signal).
 * Structural: max-depth / max-params / max-nested-callbacks (catch wide APIs / deep nesting).
 */
const sharedTsRules = Object.assign({}, tseslint.configs.recommended.rules, {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: true } }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  // Security
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'prefer-const': 'error',
  'max-lines-per-function': ['error', { max: 200 }],
  'max-depth': ['error', { max: 4 }],
  'max-params': ['error', { max: 6 }],
  'max-nested-callbacks': ['error', { max: 4 }],
  // SonarJS
  'sonarjs/cyclomatic-complexity': ['error', { threshold: 15 }],
  'sonarjs/cognitive-complexity': ['error', 15],
  'sonarjs/no-duplicate-string': 'error',
  'sonarjs/prefer-immediate-return': 'error',
  'no-unreachable': 'error',
});

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-serve/**',
      '.claude/**',
      '.cursor/**',
      '.serena/**',
      '.trunk/**',
      '**/*.generated.ts',
    ],
  },
  {
    files: ['vitest.config.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsParserOptions,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs,
    },
    rules: {
      ...sharedTsRules,
    },
  },
  {
    files: ['packages/**/*.ts', 'packages/**/*.tsx'],
    ignores: ['**/dist/**', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsParserOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs,
    },
    rules: {
      ...sharedTsRules,
      '@typescript-eslint/no-unused-private-class-members': 'error',
    },
  },
  {
    files: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    ignores: ['**/dist/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsParserOptions,
        ecmaFeatures: { jsx: true },
      },
      globals: vitestPlugin.environments.env.globals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs,
      ...vitestPlugin.configs.recommended.plugins,
    },
    rules: {
      ...sharedTsRules,
      ...vitestPlugin.configs.recommended.rules,
      // Tests often repeat string literals and use conditional expects; keep signal without noise.
      'vitest/no-conditional-expect': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'max-lines-per-function': ['error', { max: 500 }],
    },
  },
  {
    files: ['**/*.js'],
    ignores: ['**/dist/**', '**/node_modules/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
