// @ts-check
/**
 * Workspace ESLint flat config.
 *
 * Philosophy: strict from the first keystroke. `any` and non-null assertions
 * are errors, not warnings. Type-aware rules use typescript-eslint's
 * projectService so every package's tsconfig is picked up automatically.
 *
 * Jest globals are scoped to `**\/*.spec.ts` files only.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Minimal Jest globals — avoids a full `globals` dep just for spec files. */
const jestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
  jest: 'readonly',
};

export default tseslint.config(
  // Global ignores. Nothing in these paths is lintable source.
  {
    ignores: [
      '**/dist/**',
      '**/out-tsc/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.nx/**',
      '**/tmp/**',
      'packages/*/dist/**',
    ],
  },

  // Base JS + typescript-eslint strict (type-checked) for all TS sources.
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Type-aware parser options. projectService auto-discovers each project's
  // tsconfig, which matches our Nx-per-package layout.
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Load-bearing hard errors. These back the "no any, no non-null assertion"
      // invariant that lets provider adapters stay honest about runtime shapes.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Consistent imports — schemas are runtime-valued (Zod) so we leave the
      // default ('type-imports' preference via stylistic) but don't force-fix.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Rely on tsconfig noUnusedLocals/noUnusedParameters; keep ESLint's
      // version off to avoid double-reporting.
      '@typescript-eslint/no-unused-vars': 'off',

      // User preference is "prefer explicit types and generics". Both of
      // these rules fight that preference in practice:
      //   - `no-inferrable-types` strips `: string = '...'` annotations even
      //     where the author wanted the annotation for docs/clarity.
      //   - `array-type` forces `readonly T[]` over `ReadonlyArray<T>`, but
      //     the generic form IS a generic and matches our house style.
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/array-type': 'off',

      // The Jest `expect(() => fn()).toThrow()` pattern is idiomatic and
      // safe — the arrow's void return is expected by the assertion.
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],
    },
  },

  // Spec files: Jest globals, and relax a few type-aware rules that fight
  // legitimate test ergonomics.
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      globals: jestGlobals,
    },
    rules: {
      // Tests intentionally assert across async boundaries without awaiting
      // each individual call; the safeParse result shape is sync.
      '@typescript-eslint/no-floating-promises': 'off',
      // `as const` in fixtures is idiomatic and safe.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },

  // Config files themselves (jest.config.ts, etc.) are not part of any
  // tsconfig include list; parse them without type info.
  {
    files: ['**/jest.config.ts', '**/jest.preset.js', 'eslint.config.mjs'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: null,
      },
    },
    // Pre-existing scaffolded jest configs carry a `/* eslint-disable */`
    // directive that's harmless and part of upstream Nx templates. Don't
    // flag it as unused here.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    ...tseslint.configs.disableTypeChecked,
  },
);
