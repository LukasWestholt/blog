import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { siteConfig } from '@/site-config'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
	const posts = (await getCollection('blog')).filter((post) => !post.data.draft)
	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: context.site ?? siteConfig.site,
		items: posts.map((post) => ({
			...post.data,
			link: `post/${post.id}/`
		}))
	})
}
