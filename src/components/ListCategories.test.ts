import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, it, expect, vi } from 'vitest'
import type { CollectionEntry } from 'astro:content'

vi.mock('astro:content', () => ({
	getCollection: vi.fn()
}))

import { getCollection } from 'astro:content'
import ListCategories from './ListCategories.astro'

const mockGetCollection = vi.mocked(getCollection)

function makePost(id: string, category: string): CollectionEntry<'blog'> {
	return {
		id,
		body: '',
		collection: 'blog',
		data: {
			title: `Post ${id}`,
			description: 'desc',
			pubDate: new Date('2026-01-01'),
			category,
			tags: [],
			draft: false
		}
	} as unknown as CollectionEntry<'blog'>
}

describe('ListCategories', () => {
	it('gives the always-visible divider an explicit light-mode color', async () => {
		mockGetCollection.mockResolvedValue([makePost('a.md', 'Projects')])

		const container = await AstroContainer.create()
		const html = await container.renderToString(ListCategories, { props: {} })

		const match = html.match(/<div class="([^"]*-z-40[^"]*)"><\/div>/)
		expect(match).not.toBeNull()
		const dividerClasses = match![1].split(/\s+/)

		// a border-b-2 with no light-mode color class falls back to
		// currentColor (effectively black), which is indistinguishable
		// from the active category's own border-secondary — swallowing the
		// active-category indicator in light mode
		expect(dividerClasses.some((c) => /^border-neutral-\d+$/.test(c))).toBe(true)
		expect(dividerClasses.some((c) => /^dark:border-neutral-\d+$/.test(c))).toBe(true)
	})
})
