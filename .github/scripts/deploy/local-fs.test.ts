import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { buildLocalManifest } from './local-fs.ts'

let dir: string | undefined

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
	dir = undefined
})

function sha256(content: string): string {
	return createHash('sha256').update(content).digest('hex')
}

describe('buildLocalManifest', () => {
	it('hashes every file, including nested ones, with "./"-prefixed relative paths', async () => {
		dir = await mkdtemp(join(tmpdir(), 'local-fs-test-'))
		await mkdir(join(dir, 'a', 'b'), { recursive: true })
		await writeFile(join(dir, 'top.txt'), 'top-content')
		await writeFile(join(dir, 'a', 'b', 'nested.txt'), 'nested-content')

		const manifest = await buildLocalManifest(dir)

		expect(manifest.size).toBe(2)
		expect(manifest.get('./top.txt')).toBe(sha256('top-content'))
		expect(manifest.get('./a/b/nested.txt')).toBe(sha256('nested-content'))
	})

	it('returns an empty manifest for an empty directory', async () => {
		dir = await mkdtemp(join(tmpdir(), 'local-fs-test-'))
		const manifest = await buildLocalManifest(dir)
		expect(manifest.size).toBe(0)
	})

	it('preserves a space in a filename', async () => {
		dir = await mkdtemp(join(tmpdir(), 'local-fs-test-'))
		await writeFile(join(dir, 'my report.txt'), 'x')
		const manifest = await buildLocalManifest(dir)
		expect(manifest.has('./my report.txt')).toBe(true)
	})
})
