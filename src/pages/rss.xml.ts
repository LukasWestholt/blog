import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { siteConfig } from '@/site-config'

export async function GET(context: any) {
	const posts = (await getCollection('blog')).filter((post) => !post.data.draft)
	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: `post/${post.slug}/`
		}))
	})
}
