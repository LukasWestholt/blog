// Manifest format matches GNU sha256sum's plain-text output exactly (64 hex
// chars, a space, a mode flag, the path), so a manifest produced by the
// original bash deploy script (or vice versa) can be read without
// translation during the transition between the two.
const LINE_PATTERN = /^([0-9a-f]{64}) [ *](.+)$/

export type Manifest = Map<string, string>

export function parseManifest(text: string): Manifest {
	const manifest: Manifest = new Map()
	for (const line of text.split('\n')) {
		if (line === '') continue
		const match = LINE_PATTERN.exec(line)
		if (!match) {
			throw new Error(`Malformed manifest line: ${JSON.stringify(line)}`)
		}
		const [, hash, path] = match
		manifest.set(path!, hash!)
	}
	return manifest
}

export function serializeManifest(manifest: Manifest): string {
	const lines = [...manifest]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([path, hash]) => `${hash}  ${path}`)
	return lines.length > 0 ? lines.join('\n') + '\n' : ''
}

export interface ManifestDiff {
	toUpload: string[]
	toDelete: string[]
}

export function diffManifests(oldManifest: Manifest, newManifest: Manifest): ManifestDiff {
	const toUpload: string[] = []
	for (const [path, hash] of newManifest) {
		if (oldManifest.get(path) !== hash) {
			toUpload.push(path)
		}
	}

	const toDelete: string[] = []
	for (const path of oldManifest.keys()) {
		if (!newManifest.has(path)) {
			toDelete.push(path)
		}
	}

	return { toUpload: toUpload.sort(), toDelete: toDelete.sort() }
}
