// @ts-check
import eslintPluginAstro from 'eslint-plugin-astro'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{
		ignores: ['dist', '.astro', 'node_modules', '.github', 'pnpm-lock.yaml', 'coverage']
	},
	...tseslint.configs.recommended,
	...eslintPluginAstro.configs.recommended,
	...eslintPluginAstro.configs['jsx-a11y-recommended'],
	{
		files: ['**/*.astro'],
		rules: {
			'astro/no-set-html-directive': 'error'
		}
	},
	{
		files: ['**/*.cjs'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off'
		}
	},
	{
		files: ['src/env.d.ts'],
		rules: {
			'@typescript-eslint/triple-slash-reference': 'off'
		}
	}
)
