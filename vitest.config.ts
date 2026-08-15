import { getViteConfig } from 'astro/config'
import { coverageConfigDefaults } from 'vitest/config'

export default getViteConfig({
	test: {
		include: ['src/**/*.test.ts', '.github/scripts/**/*.test.ts'],
		coverage: {
			exclude: [
				...coverageConfigDefaults.exclude,
				'**/*.astro',
				'src/content/**',
				'astro.config.mjs',
				'tailwind.config.cjs',
				// static config objects, no logic to cover
				'src/data/site.config.ts',
				'src/data/disqus.config.ts',
				'src/data/links.ts'
			]
		}
	}
})
