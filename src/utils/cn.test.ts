import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn()', () => {
	it('returns a single class unchanged', () => {
		expect(cn('foo')).toBe('foo')
	})

	it('merges multiple classes', () => {
		expect(cn('foo', 'bar')).toBe('foo bar')
	})

	it('handles conditional classes via object syntax', () => {
		expect(cn('foo', { bar: true, baz: false })).toBe('foo bar')
	})

	it('handles conditional classes via array syntax', () => {
		expect(cn(['foo', 'bar'])).toBe('foo bar')
	})

	it('filters out falsy values', () => {
		expect(cn('foo', undefined, null, false, '', 'bar')).toBe('foo bar')
	})

	it('resolves Tailwind conflicts — last class wins', () => {
		expect(cn('p-2', 'p-4')).toBe('p-4')
		expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
	})

	it('returns empty string when no classes given', () => {
		expect(cn()).toBe('')
	})
})
