import { describe, it, expect } from 'vitest'
import { url, stripBase } from './url'

const PREVIEW_BASE = '/preview/my-branch/'

describe('url()', () => {
	it('returns # unchanged', () => {
		expect(url('#')).toBe('#')
	})

	it('returns path as-is when base is /', () => {
		expect(url('/post/foo/')).toBe('/post/foo/')
		expect(url('/en/tags/')).toBe('/en/tags/')
	})

	describe('with preview base', () => {
		it('prepends base to path', () => {
			expect(url('/post/foo/', PREVIEW_BASE)).toBe('/preview/my-branch/post/foo/')
		})

		it('prepends base to /en/ path', () => {
			expect(url('/en/category/projects/1', PREVIEW_BASE)).toBe(
				'/preview/my-branch/en/category/projects/1'
			)
		})

		it('still returns # unchanged', () => {
			expect(url('#', PREVIEW_BASE)).toBe('#')
		})
	})
})

describe('stripBase()', () => {
	it('returns pathname unchanged when base is /', () => {
		expect(stripBase('/en/category/football-manager/1/')).toBe('/en/category/football-manager/1/')
		expect(stripBase('/')).toBe('/')
	})

	describe('with preview base', () => {
		it('strips base prefix from pathname', () => {
			expect(stripBase('/preview/my-branch/en/category/football-manager/1/', PREVIEW_BASE)).toBe(
				'/en/category/football-manager/1/'
			)
		})

		it('returns / when pathname equals base with trailing slash', () => {
			expect(stripBase('/preview/my-branch/', PREVIEW_BASE)).toBe('/')
		})

		it('returns / when pathname equals base without trailing slash', () => {
			expect(stripBase('/preview/my-branch', PREVIEW_BASE)).toBe('/')
		})

		it('returns pathname unchanged when prefix does not match', () => {
			expect(stripBase('/other/path/', PREVIEW_BASE)).toBe('/other/path/')
		})

		it('isEnglish detection works correctly after stripBase', () => {
			const stripped = stripBase('/preview/my-branch/en/category/football-manager/1/', PREVIEW_BASE)
			expect(stripped.startsWith('/en/')).toBe(true)
		})
	})
})
