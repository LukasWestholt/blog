import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CollectionEntry } from 'astro:content'
import type { APIContext } from 'astro'

vi.mock('astro:content', () => ({
	getCollection: vi.fn()
}))

import { getCollection } from 'astro:content'
import { GET } from '../rss.xml'

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
		},
		render: vi.fn()
	} as unknown as CollectionEntry<'blog'>
}

function makeContext(): APIContext {
	return { site: new URL('https://example.com/') } as unknown as APIContext
}

beforeEach(() => {
	vi.resetAllMocks()
})

describe('GET() rss feed', () => {
	it('excludes draft posts', async () => {
		mockGetCollection.mockResolvedValue([makePost('published'), makePost('draft', { draft: true })])
		const response = await GET(makeContext())
		const xml = await response.text()
		expect(xml).toContain('Post published')
		expect(xml).not.toContain('Post draft')
	})

	it('links each item to its post slug', async () => {
		mockGetCollection.mockResolvedValue([makePost('foo')])
		const response = await GET(makeContext())
		const xml = await response.text()
		expect(xml).toContain('<link>https://example.com/post/foo/</link>')
	})

	it('falls back to context.site when siteConfig has no site set', async () => {
		mockGetCollection.mockResolvedValue([makePost('foo')])
		const response = await GET({ site: undefined } as unknown as APIContext)
		expect(response.status).toBe(200)
	})
})
