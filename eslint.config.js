import { FlatCompat } from "@eslint/eslintrc";
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default tseslint.config(
  {
		// P48-13: migrated off `next lint` (deprecated) onto the ESLint CLI —
		// `next lint` silently scoped itself to a fixed set of directories, so
		// `eslint .` needs its own ignores for everything that was never meant
		// to be linted: build output, the generated Prisma client (never
		// committed — see .gitignore), coverage, and Playwright's own output.
		ignores: ['.next', '.next-*/**', 'generated/**', 'coverage/**', 'test-results/**', 'next-env.d.ts', 'roadmap/**', '.claude/**']
	},
  ...compat.extends("next/core-web-vitals"),
  {
    files: ['**/*.ts', '**/*.tsx'],
		extends: [
			...tseslint.configs.recommended,
			...tseslint.configs.recommendedTypeChecked,
			...tseslint.configs.stylisticTypeChecked
		],
      rules: {
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/consistent-type-definitions": "off",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      // ignoreRestSiblings: the `const { buffer: _buffer, ...rest } = x` /
      // `const { password: _password, ...safeUser } = user` pattern — pulling
      // a field OUT of an object via destructuring specifically to exclude it
      // from `rest` — is deliberate, not an unused binding.
      { argsIgnorePattern: "^_", ignoreRestSiblings: true },
    ],
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
  },
  },
  {
    // P48-13: node:test's `test(name, fn)` returns a Promise that resolves
    // when the test finishes — that's by design (it's how `--test-concurrency`
    // and reporters track completion), not a caller forgetting to await it.
    // `no-floating-promises` doesn't know that convention, so every
    // `test("...", async () => {...})` call in tests/node would otherwise be
    // a lint error. Scoped to tests/** only — production code still enforces
    // the rule at full strength.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
		linterOptions: {
			reportUnusedDisableDirectives: true
		},
		languageOptions: {
			parserOptions: {
				projectService: true
			}
		}
	}
)
