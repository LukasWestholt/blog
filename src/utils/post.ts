import { getCollection } from 'astro:content'
import { CATEGORIES } from '@/data/categories'

export const getCategories = async (lang: 'de' | 'en' | 'all' = 'de') => {
	const posts = await getPosts(undefined, lang)
	const categories = new Set(posts.map((post) => post.data.category))
	return Array.from(categories).sort((a, b) =>
		CATEGORIES.indexOf(a) < CATEGORIES.indexOf(b) ? -1 : 1
	)
}

export const getPosts = async (max?: number, lang: 'de' | 'en' | 'all' = 'de') => {
	const allPosts = await getCollection('blog')
	const publishedPosts = allPosts.filter((post) => !post.data.draft)

	return publishedPosts
		.filter((post) => {
			if (lang === 'all') return true

			const isEnglish = post.id.startsWith('en/')
			const slugWithoutLang = isEnglish ? post.slug.replace(/^en\//, '') : post.slug

			const hasEnglishVersion =
				isEnglish || publishedPosts.some((p) => p.slug === `en/${slugWithoutLang}`)
			const hasGermanVersion = !isEnglish || publishedPosts.some((p) => p.slug === slugWithoutLang)

			if (lang === 'de') {
				if (!isEnglish) return true
				if (isEnglish && !hasGermanVersion) return true // Zeige englischen Post, falls DE nicht existiert
				return false
			}

			if (lang === 'en') {
				if (isEnglish) return true
				if (!isEnglish && !hasEnglishVersion) return true // Zeige deutschen Post, falls EN nicht existiert
				return false
			}

			return true
		})
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
		.slice(0, max)
}

export const getTags = async (lang: 'de' | 'en' | 'all' = 'de') => {
	const posts = await getPosts(undefined, lang)
	const tags = new Set<string>()
	posts.forEach((post) => {
		post.data.tags.forEach((tag) => {
			if (tag != '') {
				tags.add(tag.toLowerCase())
			}
		})
	})

	return Array.from(tags)
}

export const getPostByTag = async (tag: string, lang: 'de' | 'en' | 'all' = 'de') => {
	const posts = await getPosts(undefined, lang)
	const lowercaseTag = tag.toLowerCase()
	return posts.filter((post) =>
		post.data.tags.some((postTag) => postTag.toLowerCase() === lowercaseTag)
	)
}

export const filterPostsByCategory = async (category: string, lang: 'de' | 'en' | 'all' = 'de') => {
	const posts = await getPosts(undefined, lang)
	return posts.filter((post) => post.data.category.toLowerCase() === category)
}
