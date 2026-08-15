import { describe, it, expect } from 'vitest'
import { parseConfig, normalizeRemoteRoot } from './config.ts'

function baseEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
	return {
		SFTP_HOST: 'example.com',
		SFTP_PORT: '22',
		SFTP_USER: 'user',
		SFTP_PASS: 'pass',
		SFTP_HOST_FINGERPRINT: 'ssh-rsa QUJD',
		REMOTE_ROOT: '/',
		...overrides
	}
}

describe('normalizeRemoteRoot', () => {
	it('collapses repeated slashes', () => {
		expect(normalizeRemoteRoot('//preview/branch/')).toBe('/preview/branch')
	})

	it('strips a trailing slash', () => {
		expect(normalizeRemoteRoot('/preview/branch/')).toBe('/preview/branch')
	})

	it('leaves an already-canonical path unchanged', () => {
		expect(normalizeRemoteRoot('/preview/branch')).toBe('/preview/branch')
	})

	it('collapses the site root to an empty string', () => {
		expect(normalizeRemoteRoot('/')).toBe('')
	})
})

describe('parseConfig', () => {
	it('parses a complete, valid env', () => {
		const config = parseConfig(baseEnv())
		expect(config.sftpHost).toBe('example.com')
		expect(config.sftpPort).toBe(22)
		expect(config.remoteRoot).toBe('')
		expect(config.distDir).toBe('dist')
		expect(config.fullSync).toBe(false)
	})

	it('throws when a required var is missing', () => {
		const env = baseEnv()
		delete env.SFTP_HOST
		expect(() => parseConfig(env)).toThrow(/SFTP_HOST/)
	})

	it('throws when SFTP_PORT is not an integer', () => {
		expect(() => parseConfig(baseEnv({ SFTP_PORT: 'not-a-number' }))).toThrow(/SFTP_PORT/)
	})

	it('respects DIST_DIR when set', () => {
		expect(parseConfig(baseEnv({ DIST_DIR: 'build' })).distDir).toBe('build')
	})

	it('parses FULL_SYNC=true as true and anything else as false', () => {
		expect(parseConfig(baseEnv({ FULL_SYNC: 'true' })).fullSync).toBe(true)
		expect(parseConfig(baseEnv({ FULL_SYNC: 'false' })).fullSync).toBe(false)
		expect(parseConfig(baseEnv()).fullSync).toBe(false)
	})

	it('parses a "keytype base64" host fingerprint', () => {
		const config = parseConfig(baseEnv({ SFTP_HOST_FINGERPRINT: 'ssh-rsa QUJD' }))
		expect(config.sftpHostKey.toString('utf-8')).toBe('ABC')
	})

	it('parses a bare base64 host fingerprint', () => {
		const config = parseConfig(baseEnv({ SFTP_HOST_FINGERPRINT: 'QUJD' }))
		expect(config.sftpHostKey.toString('utf-8')).toBe('ABC')
	})
})
