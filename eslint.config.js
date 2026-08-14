import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'public'],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // AGENTS.md, Code style: "Prefer readonly on every field that is not reassigned."
      '@typescript-eslint/prefer-readonly': 'error',
      // eslint-plugin-import would be a dependency for one rule; this is the same ban.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Named exports only (AGENTS.md, Code style).',
        },
      ],
      'no-console': 'error',
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Invariant 1: src/core must be portable TypeScript, runnable in a Node test with no DOM.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*'],
              message: 'src/core must never import Phaser (AGENTS.md, invariant 1).',
            },
          ],
        },
      ],
    },
  },
  {
    // Vite and Vitest config files legitimately default-export their config object.
    files: ['vite.config.ts', 'vitest.config.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // This config file itself is plain JS and is not in the tsconfig project, so the
    // type-aware rules have no program to consult.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
);
