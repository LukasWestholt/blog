import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { remarkReadingTime } from './src/utils/readTime.ts'
import { siteConfig } from './src/data/site.config'

// https://astro.build/config
export default defineConfig({
	site: siteConfig.site,
	base: process.env.ASTRO_BASE || '/',
	i18n: {
		defaultLocale: 'de',
		locales: ['de', 'en'],
		routing: {
			prefixDefaultLocale: false
		}
	},
	markdown: {
		remarkPlugins: [remarkReadingTime],
		shikiConfig: {
			theme: 'material-theme-palenight',
			wrap: true
		}
	},
	integrations: [
		...(process.env.ASTRO_BASE ? [] : [sitemap()]),
		mdx({
			syntaxHighlight: 'shiki',
			shikiConfig: {
				experimentalThemes: {
					light: 'vitesse-light',
					dark: 'material-theme-palenight'
				},
				wrap: true
			}
		})
	],
	vite: {
		plugins: [tailwindcss()]
	}
})
