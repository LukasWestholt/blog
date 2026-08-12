import { describe, expect, it } from 'vitest'
import { sluglify, unsluglify } from '@/utils'

describe('sluglify', () => {
	it('replaces whitespace runs with a single dash', () => {
		expect(sluglify('Football Manager')).toBe('Football-Manager')
		expect(sluglify('a   b\tc')).toBe('a-b-c')
	})

	it('leaves text without whitespace unchanged', () => {
		expect(sluglify('football-manager')).toBe('football-manager')
	})
})

describe('unsluglify', () => {
	it('replaces dashes with spaces', () => {
		expect(unsluglify('football-manager')).toBe('football manager')
	})

	it('leaves text without dashes unchanged', () => {
		expect(unsluglify('football')).toBe('football')
	})
})
