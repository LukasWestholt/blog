import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CollectionEntry } from 'astro:content'

vi.mock('astro:content', () => ({
	getCollection: vi.fn()
}))

import { getCollection } from 'astro:content'
import {
	getPosts,
	getTags,
	getPostByTag,
	filterPostsByCategory,
	getRelatedPosts,
	getCategories
} from './post'

const mockGetCollection = vi.mocked(getCollection)

function makePost(
	id: string,
	overrides: Partial<CollectionEntry<'blog'>['data']> = {}
): CollectionEntry<'blog'> {
	return {
		id,
		body: '',
		collection: 'blog',
		data: {
			title: `Post ${id}`,
			description: 'desc',
			pubDate: new Date('2024-01-01'),
			category: 'IT',
			tags: [],
			draft: false,
			...overrides
		}
	} as unknown as CollectionEntry<'blog'>
}

beforeEach(() => {
	vi.resetAllMocks()
})

describe('getPosts()', () => {
	describe('draft filtering', () => {
		it('excludes draft posts', async () => {
			mockGetCollection.mockResolvedValue([
				makePost('published'),
				makePost('draft', { draft: true })
			])
			const posts = await getPosts()
			expect(posts.map((p) => p.id)).toEqual(['published'])
		})
	})

	describe('lang=de (default)', () => {
		it('includes German posts', async () => {
			mockGetCollection.mockResolvedValue([makePost('foo')])
			const posts = await getPosts(undefined, 'de')
			expect(posts.map((p) => p.id)).toContain('foo')
		})

		it('excludes English posts that have a German counterpart', async () => {
			mockGetCollection.mockResolvedValue([makePost('foo'), makePost('en/foo')])
			const posts = await getPosts(undefined, 'de')
			expect(posts.map((p) => p.id)).toContain('foo')
			expect(posts.map((p) => p.id)).not.toContain('en/foo')
		})

		it('includes English-only posts as fallback when no German version exists', async () => {
			mockGetCollection.mockResolvedValue([makePost('en/only-english')])
			const posts = await getPosts(undefined, 'de')
			expect(posts.map((p) => p.id)).toContain('en/only-english')
		})
	})

	describe('lang=en', () => {
		it('includes English posts', async () => {
			mockGetCollection.mockResolvedValue([makePost('en/foo')])
			const posts = await getPosts(undefined, 'en')
			expect(posts.map((p) => p.id)).toContain('en/foo')
		})

		it('excludes German posts that have an English counterpart', async () => {
			mockGetCollection.mockResolvedValue([makePost('foo'), makePost('en/foo')])
			const posts = await getPosts(undefined, 'en')
			expect(posts.map((p) => p.id)).toContain('en/foo')
			expect(posts.map((p) => p.id)).not.toContain('foo')
		})

		it('includes German-only posts as fallback when no English version exists', async () => {
			mockGetCollection.mockResolvedValue([makePost('only-german')])
			const posts = await getPosts(undefined, 'en')
			expect(posts.map((p) => p.id)).toContain('only-german')
		})
	})

	describe('lang=all', () => {
		it('includes all published posts regardless of language', async () => {
			mockGetCollection.mockResolvedValue([makePost('foo'), makePost('en/foo')])
			const posts = await getPosts(undefined, 'all')
			expect(posts.map((p) => p.id)).toContain('foo')
			expect(posts.map((p) => p.id)).toContain('en/foo')
		})
	})

	describe('sorting', () => {
		it('sorts posts by pubDate descending', async () => {
			mockGetCollection.mockResolvedValue([
				makePost('older', { pubDate: new Date('2023-01-01') }),
				makePost('newer', { pubDate: new Date('2024-06-01') }),
				makePost('middle', { pubDate: new Date('2024-01-01') })
			])
			const posts = await getPosts(undefined, 'all')
			expect(posts.map((p) => p.id)).toEqual(['newer', 'middle', 'older'])
		})
	})

	describe('max parameter', () => {
		it('limits the number of returned posts', async () => {
			mockGetCollection.mockResolvedValue([
				makePost('a', { pubDate: new Date('2024-03-01') }),
				makePost('b', { pubDate: new Date('2024-02-01') }),
				makePost('c', { pubDate: new Date('2024-01-01') })
			])
			const posts = await getPosts(2, 'all')
			expect(posts).toHaveLength(2)
			expect(posts[0].id).toBe('a')
		})
	})
})

describe('getCategories()', () => {
	it('returns unique categories from published posts', async () => {
		mockGetCollection.mockResolvedValue([
			makePost('a', { category: 'IT' }),
			makePost('b', { category: 'Projects' }),
			makePost('c', { category: 'IT' })
		])
		const categories = await getCategories('all')
		expect(categories).toEqual(['IT', 'Projects'])
	})

	it('sorts categories by CATEGORIES order, not appearance order', async () => {
		mockGetCollection.mockResolvedValue([
			makePost('a', { category: 'Research' }),
			makePost('b', { category: 'IT' }),
			makePost('c', { category: 'Projects' })
		])
		const categories = await getCategories('all')
		expect(categories).toEqual(['IT', 'Projects', 'Research'])
	})
})

describe('getTags()', () => {
	it('returns all unique tags', async () => {
		mockGetCollection.mockResolvedValue([
			makePost('a', { tags: ['Astro', 'TypeScript'] }),
			makePost('b', { tags: ['TypeScript', 'CSS'] })
		])
		const tags = await getTags('all')
		expect(tags).toContain('Astro')
		expect(tags).toContain('TypeScript')
		expect(tags).toContain('CSS')
		expect(tags).toHaveLength(3)
	})

	it('deduplicates tags case-insensitively, preserving first-seen casing', async () => {
		mockGetCollection.mockResolvedValue([
			makePost('a', { tags: ['Football'] }),
			makePost('b', { tags: ['football'] })
		])
		const tags = await getTags('all')
		expect(tags).toHaveLength(1)
		expect(tags[0]).toBe('Football')
	})

	it('filters out empty string tags', async () => {
		mockGetCollection.mockResolvedValue([makePost('a', { tags: ['', 'Astro'] })])
		const tags = await getTags('all')
		expect(tags).not.toContain('')
		expect(tags).toContain('Astro')
	})
})

describe('getPostByTag()', () => {
	it('returns posts matching the tag case-insensitively', async () => {
		mockGetCollection.mockResolvedValue([
			makePost('a', { tags: ['Astro'] }),
			makePost('b', { tags: ['TypeScript'] })
		])
		const posts = await getPostByTag('astro', 'all')
		expect(posts.map((p) => p.id)).toEqual(['a'])
	})

	it('returns empty array when no posts match', async () => {
		mockGetCollection.mockResolvedValue([makePost('a', { tags: ['Astro'] })])
		const posts = await getPostByTag('vue', 'all')
		expect(posts).toHaveLength(0)
	})
})

describe('filterPostsByCategory()', () => {
	it('returns posts in the given category case-insensitively', async () => {
		mockGetCollection.mockResolvedValue([
			makePost('a', { category: 'IT' }),
			makePost('b', { category: 'Projects' })
		])
		const posts = await filterPostsByCategory('it', 'all')
		expect(posts.map((p) => p.id)).toEqual(['a'])
	})

	it('returns empty array when no posts match', async () => {
		mockGetCollection.mockResolvedValue([makePost('a', { category: 'IT' })])
		const posts = await filterPostsByCategory('projects', 'all')
		expect(posts).toHaveLength(0)
	})
})

describe('getRelatedPosts()', () => {
	it('excludes the current post', async () => {
		const current = makePost('current', { category: 'IT' })
		mockGetCollection.mockResolvedValue([current, makePost('other', { category: 'IT' })])
		const related = await getRelatedPosts(current, 'all')
		expect(related.map((p) => p.id)).not.toContain('current')
	})

	it('prefers posts from the same category', async () => {
		const current = makePost('current', { category: 'IT', tags: ['shared'] })
		mockGetCollection.mockResolvedValue([
			current,
			makePost('same-cat', { category: 'IT' }),
			makePost('diff-cat-shared-tag', { category: 'Projects', tags: ['shared'] })
		])
		const related = await getRelatedPosts(current, 'all')
		expect(related[0].id).toBe('same-cat')
	})

	it('falls back to tag-based matching when not enough category matches', async () => {
		const current = makePost('current', { category: 'IT', tags: ['Astro'] })
		mockGetCollection.mockResolvedValue([
			current,
			makePost('tag-match', { category: 'Projects', tags: ['Astro'] })
		])
		const related = await getRelatedPosts(current, 'all')
		expect(related.map((p) => p.id)).toContain('tag-match')
	})

	it('respects the max parameter', async () => {
		const current = makePost('current', { category: 'IT' })
		mockGetCollection.mockResolvedValue([
			current,
			makePost('a', { category: 'IT' }),
			makePost('b', { category: 'IT' }),
			makePost('c', { category: 'IT' }),
			makePost('d', { category: 'IT' })
		])
		const related = await getRelatedPosts(current, 'all', 2)
		expect(related).toHaveLength(2)
	})
})
