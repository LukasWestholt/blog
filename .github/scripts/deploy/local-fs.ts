import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { Manifest } from './manifest.ts'

async function listFilesRecursive(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true })
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
}

async function hashFile(filePath: string): Promise<string> {
	const content = await readFile(filePath)
	return createHash('sha256').update(content).digest('hex')
}

// Paths are kept "./"-prefixed to match sha256sum's own `find . -type f`
// output format (see manifest.ts) -- this is what the original bash
// deploy script's manifests look like, and what a full-sync remote listing
// needs to line up against.
export async function buildLocalManifest(distDir: string): Promise<Manifest> {
	const filePaths = await listFilesRecursive(distDir)
	const entries = await Promise.all(
		filePaths.map(async (absolutePath) => {
			const relPath = `./${relative(distDir, absolutePath)}`
			return [relPath, await hashFile(absolutePath)] as const
		})
	)
	return new Map(entries)
}
