import { readFile } from 'node:fs/promises'
import ignore, { type Ignore } from 'ignore'

// Absent entirely on a brand new preview path or a repo that doesn't define
// one -- that's fine, it just means nothing is excluded. Any other read
// failure (permissions, EISDIR, etc.) propagates rather than being treated
// the same way, since silently falling back to "nothing excluded" here is
// exactly the failure mode that would let a full sync delete preview/.
export async function loadIgnoreMatcher(filePath: string): Promise<Ignore> {
	let content: string
	try {
		content = await readFile(filePath, 'utf-8')
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return ignore()
		}
		throw error
	}

	return ignore().add(content)
}

export function isIgnored(matcher: Ignore, relativePath: string): boolean {
	// `ignore` expects paths without a leading "./"; the manifest format
	// keeps that prefix for sha256sum compatibility (see manifest.ts).
	return matcher.ignores(relativePath.replace(/^\.\//, ''))
}
