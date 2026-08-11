import { describe, it, expect } from 'vitest'

// Pure extraction of the untranslatable-path logic from LanguageSwitcher.astro.
// Regression test for the trailing-slash bug: /impress/ was not matched against ['/impress'].
function isUntranslatable(currentPath: string, untranslatablePaths: string[]): boolean {
	const basePath = currentPath.replace(/^\/en/, '') || '/'
	const normalizedPath = basePath.replace(/\/$/, '') || '/'
	return untranslatablePaths.includes(normalizedPath)
}

const UNTRANSLATABLE = ['/impress']

describe('untranslatablePaths matching', () => {
	it('matches path without trailing slash', () => {
		expect(isUntranslatable('/impress', UNTRANSLATABLE)).toBe(true)
	})

	it('matches path with trailing slash', () => {
		expect(isUntranslatable('/impress/', UNTRANSLATABLE)).toBe(true)
	})

	it('does not match translatable paths', () => {
		expect(isUntranslatable('/', UNTRANSLATABLE)).toBe(false)
		expect(isUntranslatable('/post/foo/', UNTRANSLATABLE)).toBe(false)
		expect(isUntranslatable('/tags/', UNTRANSLATABLE)).toBe(false)
		expect(isUntranslatable('/category/projects/1/', UNTRANSLATABLE)).toBe(false)
	})

	it('strips /en prefix before matching', () => {
		expect(isUntranslatable('/en/impress', UNTRANSLATABLE)).toBe(true)
		expect(isUntranslatable('/en/impress/', UNTRANSLATABLE)).toBe(true)
	})

	it('does not falsely match paths that start with /impress', () => {
		expect(isUntranslatable('/impressum/', UNTRANSLATABLE)).toBe(false)
	})
})
