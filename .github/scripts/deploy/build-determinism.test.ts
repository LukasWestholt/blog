import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { buildLocalManifest } from './local-fs.ts'

// Astro's build moves files from an intermediate directory into outDir via
// fs.rename(), which fails across filesystem boundaries -- os.tmpdir()
// (/tmp) is commonly a separate mount from the repo, so the scratch
// directories live under node_modules (already gitignored) instead.
const scratchRoot = join(process.cwd(), 'node_modules', '.build-determinism-test')

// Runs two full Astro builds of the identical source and diffs their
// content hashes. This is what actually caught astro-font generating a
// random CSS fallback name on every build (Math.random() * Date.now()),
// which made every page using it hash-differ from the previous deploy
// regardless of whether anything real had changed -- silently defeating
// the whole point of the manifest-diff deploy scheme for those pages.
// Runs the real build twice, so it's slow; that's the actual guarantee
// being tested, a narrower unit test can't stand in for it.
describe('build determinism', () => {
	it('produces byte-identical dist/ output across two consecutive builds of the same source', async () => {
		await mkdir(scratchRoot, { recursive: true })
		const outDir1 = await mkdtemp(join(scratchRoot, '1-'))
		const outDir2 = await mkdtemp(join(scratchRoot, '2-'))

		try {
			execFileSync('pnpm', ['exec', 'astro', 'build', '--outDir', outDir1], { stdio: 'pipe' })
			execFileSync('pnpm', ['exec', 'astro', 'build', '--outDir', outDir2], { stdio: 'pipe' })

			const manifest1 = await buildLocalManifest(outDir1)
			const manifest2 = await buildLocalManifest(outDir2)

			const changed: string[] = []
			for (const [path, hash] of manifest1) {
				if (manifest2.get(path) !== hash) changed.push(path)
			}
			for (const path of manifest2.keys()) {
				if (!manifest1.has(path)) changed.push(path)
			}

			expect(changed.sort()).toEqual([])
		} finally {
			await rm(outDir1, { recursive: true, force: true })
			await rm(outDir2, { recursive: true, force: true })
		}
	}, 180_000)
})
