import { fileURLToPath } from 'node:url'
import { parseConfig, type DeployConfig } from './deploy/config.ts'
import { buildLocalManifest } from './deploy/local-fs.ts'
import {
	parseManifest,
	serializeManifest,
	diffManifests,
	type Manifest
} from './deploy/manifest.ts'
import { loadIgnoreMatcher } from './deploy/ignore.ts'
import {
	connect,
	fetchManifestText,
	publishManifest,
	uploadFiles,
	deleteFiles,
	listRemoteFilesRecursive
} from './deploy/remote-fs.ts'
import type SftpClient from 'ssh2-sftp-client'

// dist/ is rebuilt from scratch on every run, so every local file is
// always "newer" than whatever's on the server -- this whole script
// exists because that made lftp's --only-newer/--ignore-time comparison
// meaningless, and it once let index.html go stale while pointing at
// asset hashes that had already been deleted (see PR #53's incident
// writeup). Instead, this diffs a sha256 manifest of the current build
// against the manifest of the last deploy (stored on the server itself)
// and only transfers what actually changed.
//
// FULL_SYNC=true bypasses the manifest diff entirely and does an
// unconditional resync of dist/ onto REMOTE_ROOT, to fix drift the
// manifest doesn't know about. Deliberate disaster-recovery action, not
// the routine deploy path.

function manifestRemotePath(remoteRoot: string): string {
	return `${remoteRoot}/.deploy-manifest.txt`
}

async function fullSync(
	client: SftpClient,
	config: DeployConfig,
	localManifest: Manifest
): Promise<void> {
	const ignoreMatcher = await loadIgnoreMatcher(config.ignoreFilePath)
	const remoteFiles = await listRemoteFilesRecursive(client, config.remoteRoot, ignoreMatcher)

	const toDelete = remoteFiles.filter((path) => !localManifest.has(path))
	const toUpload = [...localManifest.keys()]

	console.log(`Files to upload: ${toUpload.length}`)
	console.log(`Files to delete: ${toDelete.length}`)

	const { failures } = await deleteFiles(client, config.remoteRoot, toDelete)
	if (failures.length > 0) {
		console.warn(
			`::warning::Delete pass had ${failures.length} failure(s); any files it didn't remove will be retried next full sync`
		)
	}

	await uploadFiles(client, config.distDir, config.remoteRoot, toUpload)
	await publishManifest(
		client,
		manifestRemotePath(config.remoteRoot),
		serializeManifest(localManifest)
	)
	console.log('Full sync complete.')
}

async function incrementalDeploy(
	client: SftpClient,
	config: DeployConfig,
	localManifest: Manifest
): Promise<void> {
	const manifestPath = manifestRemotePath(config.remoteRoot)
	const remoteManifestText = await fetchManifestText(client, manifestPath)
	// Absent on a brand new preview path or the first deploy under this
	// scheme, so treat everything as new then.
	const oldManifest = remoteManifestText ? parseManifest(remoteManifestText) : new Map()

	const { toUpload, toDelete } = diffManifests(oldManifest, localManifest)
	console.log(`Files to upload: ${toUpload.length}`)
	console.log(`Files to delete: ${toDelete.length}`)

	// Runs before upload so a path that changed kind between builds (file
	// <-> directory) doesn't collide with the stale remote entry.
	// Best-effort: failures here don't abort the deploy.
	const { failures } = await deleteFiles(client, config.remoteRoot, toDelete)
	if (failures.length > 0) {
		console.warn(
			`::warning::Delete pass had ${failures.length} failure(s); any files it didn't remove will be retried next deploy`
		)
	}

	// Not wrapped in try/catch: an upload failure must propagate and block
	// the manifest publish below, so a subsequent run's diff still sees
	// these files as needing upload rather than believing they landed.
	await uploadFiles(client, config.distDir, config.remoteRoot, toUpload)

	await publishManifest(client, manifestPath, serializeManifest(localManifest))
	console.log('Deploy complete.')
}

export async function main(): Promise<void> {
	const config = parseConfig(process.env)

	const localManifest = await buildLocalManifest(config.distDir)
	if (localManifest.size === 0) {
		throw new Error(
			`${config.distDir} contains no files; refusing to deploy (this would delete everything remote)`
		)
	}

	const client = await connect(config)
	try {
		if (config.fullSync) {
			await fullSync(client, config, localManifest)
		} else {
			await incrementalDeploy(client, config, localManifest)
		}
	} finally {
		await client.end()
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error: unknown) => {
		console.error(error)
		process.exitCode = 1
	})
}
