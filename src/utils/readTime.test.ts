import { describe, it, expect } from 'vitest'
import { remarkReadingTime } from './readTime'

function makeTree(text: string) {
	return {
		type: 'root',
		children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }]
	}
}

function makeVfile() {
	return { data: { astro: { frontmatter: {} as Record<string, unknown> } } }
}

describe('remarkReadingTime()', () => {
	it('sets minutesRead on frontmatter', () => {
		const plugin = remarkReadingTime()
		const vfile = makeVfile()
		plugin(makeTree('Hello world'), vfile)
		expect(vfile.data.astro.frontmatter.minutesRead).toBeDefined()
		expect(typeof vfile.data.astro.frontmatter.minutesRead).toBe('string')
	})

	it('produces a non-empty reading time string', () => {
		const plugin = remarkReadingTime()
		const vfile = makeVfile()
		plugin(makeTree('word '.repeat(300)), vfile)
		expect(vfile.data.astro.frontmatter.minutesRead).toMatch(/\d+ min read/)
	})

	it('works for very short content', () => {
		const plugin = remarkReadingTime()
		const vfile = makeVfile()
		plugin(makeTree('Hi'), vfile)
		expect(vfile.data.astro.frontmatter.minutesRead).toBeTruthy()
	})

	it('works for empty content', () => {
		const plugin = remarkReadingTime()
		const vfile = makeVfile()
		plugin(makeTree(''), vfile)
		expect(vfile.data.astro.frontmatter.minutesRead).toBeDefined()
	})
})
