import { getViteConfig } from 'astro/config'
import { coverageConfigDefaults } from 'vitest/config'

export default getViteConfig({
	test: {
		include: ['src/**/*.test.ts'],
		coverage: {
			exclude: [
				...coverageConfigDefaults.exclude,
				'**/*.astro',
				'src/content/**',
				'astro.config.mjs',
				// static config objects, no logic to cover
				'src/data/site.config.ts',
				'src/data/disqus.config.ts',
				'src/data/links.ts'
			]
		}
	}
} as Parameters<typeof getViteConfig>[0])
