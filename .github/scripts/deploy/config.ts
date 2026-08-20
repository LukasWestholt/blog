export interface DeployConfig {
	sftpHost: string
	sftpPort: number
	sftpUser: string
	sftpPass: string
	/** Raw host key bytes to pin the connection against -- see remote-fs.ts. */
	sftpHostKey: Buffer
	/** Canonical: slash-collapsed, no trailing slash. */
	remoteRoot: string
	distDir: string
	fullSync: boolean
	ignoreFilePath: string
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
	const value = env[key]
	if (!value) {
		throw new Error(`${key} is required`)
	}
	return value
}

// The workflow embeds this the same way it would as a known_hosts line --
// "ssh-rsa AAAA..." -- so accept that shape, but also a bare base64 key.
function parseHostKey(fingerprint: string): Buffer {
	const parts = fingerprint.trim().split(/\s+/)
	const base64Key = parts.length > 1 ? parts[1] : parts[0]
	if (!base64Key) {
		throw new Error(`SFTP_HOST_FINGERPRINT is not a valid key: ${JSON.stringify(fingerprint)}`)
	}
	return Buffer.from(base64Key, 'base64')
}

// Collapse repeated slashes (a caller joining an already "/"-rooted value
// with "/preview/<branch>/" produces "//preview/..."), then strip a
// trailing slash so this is canonical everywhere downstream. Callers that
// need a trailing slash add it back explicitly.
export function normalizeRemoteRoot(remoteRoot: string): string {
	return remoteRoot.replace(/\/+/g, '/').replace(/\/$/, '')
}

export function parseConfig(env: NodeJS.ProcessEnv): DeployConfig {
	const sftpPort = Number(requireEnv(env, 'SFTP_PORT'))
	if (!Number.isInteger(sftpPort)) {
		throw new Error(`SFTP_PORT must be an integer, got: ${env.SFTP_PORT}`)
	}

	return {
		sftpHost: requireEnv(env, 'SFTP_HOST'),
		sftpPort,
		sftpUser: requireEnv(env, 'SFTP_USER'),
		sftpPass: requireEnv(env, 'SFTP_PASS'),
		sftpHostKey: parseHostKey(requireEnv(env, 'SFTP_HOST_FINGERPRINT')),
		remoteRoot: normalizeRemoteRoot(requireEnv(env, 'REMOTE_ROOT')),
		distDir: env.DIST_DIR ?? 'dist',
		fullSync: env.FULL_SYNC === 'true',
		ignoreFilePath: env.IGNORE_FILE ?? '.lftp_ignore'
	}
}
