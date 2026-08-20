import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadIgnoreMatcher, isIgnored } from './ignore.ts'

let dir: string | undefined

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
	dir = undefined
})

async function writeIgnoreFile(content: string): Promise<string> {
	dir = await mkdtemp(join(tmpdir(), 'ignore-test-'))
	const filePath = join(dir, '.lftp_ignore')
	await writeFile(filePath, content)
	return filePath
}

describe('loadIgnoreMatcher / isIgnored', () => {
	it('excludes a path under a directory pattern, including the directory itself', async () => {
		const filePath = await writeIgnoreFile('preview/\n')
		const matcher = await loadIgnoreMatcher(filePath)
		expect(isIgnored(matcher, './preview/some-branch/index.html')).toBe(true)
		expect(isIgnored(matcher, './preview/')).toBe(true)
	})

	it('does not exclude an unrelated path', async () => {
		const filePath = await writeIgnoreFile('preview/\n')
		const matcher = await loadIgnoreMatcher(filePath)
		expect(isIgnored(matcher, './post/some-article/index.html')).toBe(false)
	})

	it('ignores comment lines and blank lines', async () => {
		const filePath = await writeIgnoreFile('# a comment\n\npreview/\n')
		const matcher = await loadIgnoreMatcher(filePath)
		expect(isIgnored(matcher, './preview/x/index.html')).toBe(true)
		// a literal "#" line shouldn't itself become a (nonsensical) pattern
		expect(isIgnored(matcher, './# a comment')).toBe(false)
	})

	it('returns a matcher that excludes nothing when the file does not exist', async () => {
		dir = await mkdtemp(join(tmpdir(), 'ignore-test-'))
		const matcher = await loadIgnoreMatcher(join(dir, '.lftp_ignore'))
		expect(isIgnored(matcher, './preview/x/index.html')).toBe(false)
	})

	it('propagates a non-ENOENT read error rather than falling back to no exclusions', async () => {
		dir = await mkdtemp(join(tmpdir(), 'ignore-test-'))
		// pass a directory where a file is expected -> EISDIR, not ENOENT
		await expect(loadIgnoreMatcher(dir)).rejects.toThrow()
	})
})
