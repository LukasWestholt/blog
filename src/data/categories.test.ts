import { describe, it, expect } from 'vitest'
import { getCategoryTranslation, CATEGORIES } from './categories'

describe('CATEGORIES', () => {
	it('contains all expected category keys', () => {
		expect(CATEGORIES).toContain('IT')
		expect(CATEGORIES).toContain('Projects')
		expect(CATEGORIES).toContain('Football Manager')
		expect(CATEGORIES).toContain('Thoughts')
		expect(CATEGORIES).toContain('Achievements')
		expect(CATEGORIES).toContain('Research')
	})
})

describe('getCategoryTranslation()', () => {
	it('translates known categories to German', () => {
		expect(getCategoryTranslation('Projects', 'de')).toBe('Projekte')
		expect(getCategoryTranslation('Thoughts', 'de')).toBe('Gedanken')
		expect(getCategoryTranslation('Achievements', 'de')).toBe('Erfolge')
	})

	it('translates known categories to English', () => {
		expect(getCategoryTranslation('Projects', 'en')).toBe('Projects')
		expect(getCategoryTranslation('Thoughts', 'en')).toBe('Thoughts')
	})

	it('returns same value for categories that are identical in both languages', () => {
		expect(getCategoryTranslation('IT', 'de')).toBe('IT')
		expect(getCategoryTranslation('IT', 'en')).toBe('IT')
		expect(getCategoryTranslation('Football Manager', 'de')).toBe('Football Manager')
		expect(getCategoryTranslation('Research', 'en')).toBe('Research')
	})

	it('is case-insensitive', () => {
		expect(getCategoryTranslation('projects', 'de')).toBe('Projekte')
		expect(getCategoryTranslation('PROJECTS', 'en')).toBe('Projects')
		expect(getCategoryTranslation('it', 'de')).toBe('IT')
	})

	it('handles "View All" special case in German', () => {
		expect(getCategoryTranslation('View All', 'de')).toBe('Alle anzeigen')
		expect(getCategoryTranslation('view all', 'de')).toBe('Alle anzeigen')
		expect(getCategoryTranslation('VIEW ALL', 'de')).toBe('Alle anzeigen')
	})

	it('handles "View All" special case in English', () => {
		expect(getCategoryTranslation('View All', 'en')).toBe('View All')
		expect(getCategoryTranslation('view all', 'en')).toBe('View All')
	})

	it('returns the original name for unknown categories', () => {
		expect(getCategoryTranslation('Unknown', 'de')).toBe('Unknown')
		expect(getCategoryTranslation('SomethingElse', 'en')).toBe('SomethingElse')
	})
})
