import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import { remarkReadingTime } from './src/utils/readTime.ts'
import { siteConfig } from './src/data/site.config'
type Locale = (typeof siteConfig.locales)[number]

// https://astro.build/config
export default defineConfig({
	site: siteConfig.site,
	markdown: {
		remarkPlugins: [remarkReadingTime],
		shikiConfig: {
			theme: 'material-theme-palenight',
			wrap: true
		}
	},
	integrations: [
		mdx({
			syntaxHighlight: 'shiki',
			shikiConfig: {
				experimentalThemes: {
					light: 'vitesse-light',
					dark: 'material-theme-palenight'
				},
				wrap: true
			}
		}),
		sitemap(),
		tailwind()
	],
	i18n: {
		locales: [...siteConfig.locales],
		defaultLocale: siteConfig.defaultLocale,
		fallback: Object.fromEntries(
			siteConfig.locales
				.filter(
					(locale: Locale): locale is Exclude<Locale, typeof siteConfig.defaultLocale> =>
						locale !== siteConfig.defaultLocale
				)
				.map((locale) => [locale, siteConfig.defaultLocale])
		)
	}
})
