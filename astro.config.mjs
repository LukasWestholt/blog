import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
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
		rehypePlugins: [
			rehypeSlug,
			[
				rehypeAutolinkHeadings,
				{
					behavior: 'prepend',
					properties: { class: 'heading-anchor', ariaHidden: 'true', tabIndex: -1 },
					content: { type: 'text', value: '#' }
				}
			]
		],
		drafts: true,
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
			},
			rehypePlugins: [
				rehypeSlug,
				[
					rehypeAutolinkHeadings,
					{
						behavior: 'prepend',
						properties: { class: 'heading-anchor', ariaHidden: 'true', tabIndex: -1 }
					}
				]
			],
			drafts: true
		}),
		tailwind()
	]
})
