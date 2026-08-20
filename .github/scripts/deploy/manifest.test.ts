import { describe, it, expect } from 'vitest'
import { parseManifest, serializeManifest, diffManifests, type Manifest } from './manifest.ts'

describe('parseManifest / serializeManifest', () => {
	it('round-trips a literal line captured from real `sha256sum` output', () => {
		// `sha256sum "./a b.txt"` on a file containing "hello", verified against
		// a real invocation -- locks in wire compatibility with the original
		// bash deploy script's manifest format.
		const line = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  ./a b.txt\n'
		const manifest = parseManifest(line)
		expect(manifest.get('./a b.txt')).toBe(
			'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
		)
		expect(serializeManifest(manifest)).toBe(line)
	})

	it('parses multiple lines and ignores a trailing blank line', () => {
		const text = 'a'.repeat(64) + '  ./foo.css\n' + 'b'.repeat(64) + '  ./bar.html\n'
		const manifest = parseManifest(text)
		expect(manifest.size).toBe(2)
		expect(manifest.get('./foo.css')).toBe('a'.repeat(64))
		expect(manifest.get('./bar.html')).toBe('b'.repeat(64))
	})

	it('parses an empty manifest', () => {
		expect(parseManifest('').size).toBe(0)
	})

	it('throws on a malformed line rather than silently dropping it', () => {
		expect(() => parseManifest('not-a-valid-manifest-line')).toThrow()
	})

	it('serializes deterministically, sorted by path', () => {
		const manifest: Manifest = new Map([
			['./z.css', 'a'.repeat(64)],
			['./a.css', 'b'.repeat(64)]
		])
		const text = serializeManifest(manifest)
		expect(text.indexOf('./a.css')).toBeLessThan(text.indexOf('./z.css'))
	})

	it('serializes an empty manifest as an empty string', () => {
		expect(serializeManifest(new Map())).toBe('')
	})
})

describe('diffManifests', () => {
	it('treats everything as new when the old manifest is empty (first deploy)', () => {
		const oldManifest: Manifest = new Map()
		const newManifest: Manifest = new Map([['./index.html', 'a'.repeat(64)]])
		expect(diffManifests(oldManifest, newManifest)).toEqual({
			toUpload: ['./index.html'],
			toDelete: []
		})
	})

	it('does not flag an unchanged file for upload or delete', () => {
		const hash = 'a'.repeat(64)
		const oldManifest: Manifest = new Map([['./unchanged.css', hash]])
		const newManifest: Manifest = new Map([['./unchanged.css', hash]])
		expect(diffManifests(oldManifest, newManifest)).toEqual({ toUpload: [], toDelete: [] })
	})

	it('flags a same-path, changed-hash file for upload, not deletion', () => {
		// This is the exact shape of the original production incident: a
		// content-hash filename rename (or, here, any content change at the
		// same path) that a size/mtime-based comparison could miss entirely.
		// Path-based identity plus a hash comparison must catch it regardless.
		const oldManifest: Manifest = new Map([['./index.html', 'a'.repeat(64)]])
		const newManifest: Manifest = new Map([['./index.html', 'b'.repeat(64)]])
		expect(diffManifests(oldManifest, newManifest)).toEqual({
			toUpload: ['./index.html'],
			toDelete: []
		})
	})

	it('flags a new path (not present before) for upload', () => {
		const oldManifest: Manifest = new Map()
		const newManifest: Manifest = new Map([['./added.css', 'a'.repeat(64)]])
		expect(diffManifests(oldManifest, newManifest)).toEqual({
			toUpload: ['./added.css'],
			toDelete: []
		})
	})

	it('flags a path missing from the new manifest for deletion', () => {
		const oldManifest: Manifest = new Map([['./removed.css', 'a'.repeat(64)]])
		const newManifest: Manifest = new Map()
		expect(diffManifests(oldManifest, newManifest)).toEqual({
			toUpload: [],
			toDelete: ['./removed.css']
		})
	})

	it('handles a mix of unchanged, changed, added, and removed in one diff', () => {
		const oldManifest: Manifest = new Map([
			['./unchanged.css', 'a'.repeat(64)],
			['./changed.css', 'b'.repeat(64)],
			['./removed.css', 'c'.repeat(64)]
		])
		const newManifest: Manifest = new Map([
			['./unchanged.css', 'a'.repeat(64)],
			['./changed.css', 'd'.repeat(64)],
			['./added.css', 'e'.repeat(64)]
		])
		expect(diffManifests(oldManifest, newManifest)).toEqual({
			toUpload: ['./added.css', './changed.css'],
			toDelete: ['./removed.css']
		})
	})
})
