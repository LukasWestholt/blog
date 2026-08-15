import SftpClient from 'ssh2-sftp-client'
import pLimit from 'p-limit'
import { join } from 'node:path'
import type { Ignore } from 'ignore'
import { isIgnored } from './ignore.ts'

const CONCURRENCY = 10

export interface SftpCredentials {
	sftpHost: string
	sftpPort: number
	sftpUser: string
	sftpPass: string
	sftpHostKey: Buffer
}

export function verifyHostKey(pinnedKey: Buffer, presentedKey: Buffer): boolean {
	return presentedKey.equals(pinnedKey)
}

export async function connect(config: SftpCredentials): Promise<SftpClient> {
	const client = new SftpClient()
	await client.connect({
		host: config.sftpHost,
		port: config.sftpPort,
		username: config.sftpUser,
		password: config.sftpPass,
		// Force the key type the pinned fingerprint was captured for -- ssh2
		// prefers ed25519/ecdsa by default, which would mean the pinned RSA
		// key is never even presented to hostVerifier to compare against.
		algorithms: { serverHostKey: ['ssh-rsa'] },
		hostVerifier: (key: Buffer) => verifyHostKey(config.sftpHostKey, key)
	})
	return client
}

// remoteRoot must already be canonical (config.ts::normalizeRemoteRoot):
// slash-collapsed, no trailing slash, root "/" as "". A caller passing a
// raw, un-normalized value here would silently produce doubled slashes in
// every path built downstream -- exactly the bug class this rewrite exists
// to eliminate -- so this fails loudly instead.
function assertCanonicalRemoteRoot(remoteRoot: string): void {
	if (remoteRoot.endsWith('/') || remoteRoot.includes('//')) {
		throw new Error(
			`remoteRoot must be canonical (no trailing/doubled slashes): ${JSON.stringify(remoteRoot)}`
		)
	}
}

function toRemotePath(remoteRoot: string, relPath: string): string {
	return `${remoteRoot}/${relPath.replace(/^\.\//, '')}`
}

export async function fetchManifestText(
	client: SftpClient,
	manifestPath: string
): Promise<string | undefined> {
	try {
		const content = await client.get(manifestPath)
		return (content as Buffer).toString('utf-8')
	} catch {
		// Absent on a brand new preview path or the first deploy under this
		// scheme, so treat everything as new then. Any other failure mode
		// (auth, connectivity) surfaces just as loudly later, at the
		// upload/full-sync call that isn't wrapped in a catch -- so being
		// unable to distinguish "doesn't exist" from "transient failure"
		// here specifically isn't a real gap.
		return undefined
	}
}

export async function publishManifest(
	client: SftpClient,
	manifestPath: string,
	content: string
): Promise<void> {
	await client.put(Buffer.from(content, 'utf-8'), manifestPath)
}

async function ensureDirectories(
	client: SftpClient,
	remoteRoot: string,
	relPaths: string[]
): Promise<void> {
	assertCanonicalRemoteRoot(remoteRoot)
	const dirs = new Set<string>()
	for (const relPath of relPaths) {
		const parts = relPath.replace(/^\.\//, '').split('/')
		parts.pop() // drop the filename
		let current = remoteRoot
		for (const part of parts) {
			current = `${current}/${part}`
			dirs.add(current)
		}
	}
	for (const dir of dirs) {
		await client.mkdir(dir, true)
	}
}

export async function uploadFiles(
	client: SftpClient,
	distDir: string,
	remoteRoot: string,
	relPaths: string[]
): Promise<void> {
	if (relPaths.length === 0) return
	await ensureDirectories(client, remoteRoot, relPaths)
	const limit = pLimit(CONCURRENCY)
	await limit.map(relPaths, async (relPath) => {
		const localPath = join(distDir, relPath)
		await client.put(localPath, toRemotePath(remoteRoot, relPath))
	})
}

export interface DeleteResult {
	failures: string[]
}

// Best-effort: a path may already be gone, which isn't fatal, so
// individual failures don't abort the pass -- they're collected and
// reported by the caller instead.
export async function deleteFiles(
	client: SftpClient,
	remoteRoot: string,
	relPaths: string[]
): Promise<DeleteResult> {
	if (relPaths.length === 0) return { failures: [] }
	assertCanonicalRemoteRoot(remoteRoot)
	const limit = pLimit(CONCURRENCY)
	const failures: string[] = []
	await limit.map(relPaths, async (relPath) => {
		try {
			await client.delete(toRemotePath(remoteRoot, relPath), true)
		} catch {
			failures.push(relPath)
		}
	})
	return { failures }
}

// Recursively lists every file under remoteRoot, "./"-prefixed to match
// the manifest path format, skipping anything the ignore matcher excludes
// (pruned during the walk -- an excluded directory is never descended
// into at all, not filtered out after the fact).
export async function listRemoteFilesRecursive(
	client: SftpClient,
	remoteRoot: string,
	ignoreMatcher: Ignore
): Promise<string[]> {
	assertCanonicalRemoteRoot(remoteRoot)
	const results: string[] = []

	async function walk(dir: string, relDir: string): Promise<void> {
		let entries: Awaited<ReturnType<SftpClient['list']>>
		try {
			entries = await client.list(dir)
		} catch (error) {
			if (relDir === '') return // remote root doesn't exist yet -- treat as empty
			throw error
		}

		for (const entry of entries) {
			const relPath = relDir ? `${relDir}/${entry.name}` : entry.name
			if (entry.type === 'd') {
				if (isIgnored(ignoreMatcher, `./${relPath}/`)) continue
				await walk(`${dir}/${entry.name}`, relPath)
			} else if (entry.type === '-') {
				if (isIgnored(ignoreMatcher, `./${relPath}`)) continue
				results.push(`./${relPath}`)
			}
		}
	}

	await walk(remoteRoot, '')
	return results
}
