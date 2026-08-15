import { describe, it, expect, vi } from 'vitest'
import type SftpClient from 'ssh2-sftp-client'
import ignore from 'ignore'
import {
	verifyHostKey,
	fetchManifestText,
	publishManifest,
	uploadFiles,
	deleteFiles,
	listRemoteFilesRecursive
} from './remote-fs.ts'

describe('verifyHostKey', () => {
	it('accepts the exact pinned key', () => {
		const key = Buffer.from('the-pinned-key')
		expect(verifyHostKey(key, Buffer.from('the-pinned-key'))).toBe(true)
	})

	it('rejects any other key', () => {
		const pinned = Buffer.from('the-pinned-key')
		expect(verifyHostKey(pinned, Buffer.from('a-different-key'))).toBe(false)
	})
})

describe('fetchManifestText', () => {
	it('returns the manifest content when get() succeeds', async () => {
		const client = { get: vi.fn().mockResolvedValue(Buffer.from('manifest content')) }
		const text = await fetchManifestText(client as unknown as SftpClient, '/.deploy-manifest.txt')
		expect(text).toBe('manifest content')
	})

	it('returns undefined when get() fails (absent manifest)', async () => {
		const client = { get: vi.fn().mockRejectedValue(new Error('No such file')) }
		const text = await fetchManifestText(client as unknown as SftpClient, '/.deploy-manifest.txt')
		expect(text).toBeUndefined()
	})
})

describe('publishManifest', () => {
	it('puts the manifest content as a Buffer to the manifest path', async () => {
		const put = vi.fn().mockResolvedValue('')
		const client = { put }
		await publishManifest(client as unknown as SftpClient, '/.deploy-manifest.txt', 'content')
		expect(put).toHaveBeenCalledTimes(1)
		const [content, remotePath] = put.mock.calls[0]!
		expect(Buffer.isBuffer(content)).toBe(true)
		expect((content as Buffer).toString('utf-8')).toBe('content')
		expect(remotePath).toBe('/.deploy-manifest.txt')
	})
})

describe('uploadFiles', () => {
	it('is a no-op for an empty list', async () => {
		const mkdir = vi.fn()
		const put = vi.fn()
		await uploadFiles({ mkdir, put } as unknown as SftpClient, 'dist', '/preview/x', [])
		expect(mkdir).not.toHaveBeenCalled()
		expect(put).not.toHaveBeenCalled()
	})

	it('creates each unique parent directory once and puts every file', async () => {
		const mkdir = vi.fn().mockResolvedValue('')
		const put = vi.fn().mockResolvedValue('')
		await uploadFiles({ mkdir, put } as unknown as SftpClient, 'dist', '/preview/x', [
			'./a/one.css',
			'./a/two.css',
			'./b/three.html'
		])

		expect(mkdir).toHaveBeenCalledTimes(2)
		expect(mkdir).toHaveBeenCalledWith('/preview/x/a', true)
		expect(mkdir).toHaveBeenCalledWith('/preview/x/b', true)

		expect(put).toHaveBeenCalledTimes(3)
		expect(put).toHaveBeenCalledWith('dist/a/one.css', '/preview/x/a/one.css')
		expect(put).toHaveBeenCalledWith('dist/a/two.css', '/preview/x/a/two.css')
		expect(put).toHaveBeenCalledWith('dist/b/three.html', '/preview/x/b/three.html')
	})
})

describe('deleteFiles', () => {
	it('is a no-op for an empty list', async () => {
		const del = vi.fn()
		const result = await deleteFiles({ delete: del } as unknown as SftpClient, '', [])
		expect(del).not.toHaveBeenCalled()
		expect(result.failures).toEqual([])
	})

	it('deletes every path with noErrorOK, tolerating individual failures', async () => {
		const del = vi.fn().mockResolvedValueOnce('').mockRejectedValueOnce(new Error('gone already'))
		const result = await deleteFiles({ delete: del } as unknown as SftpClient, '', [
			'./ok.css',
			'./already-gone.css'
		])

		expect(del).toHaveBeenCalledWith('/ok.css', true)
		expect(del).toHaveBeenCalledWith('/already-gone.css', true)
		expect(result.failures).toEqual(['./already-gone.css'])
	})

	it('rejects a non-canonical remoteRoot rather than building a doubled-slash path', async () => {
		const del = vi.fn().mockResolvedValue('')
		await expect(
			deleteFiles({ delete: del } as unknown as SftpClient, '/', ['./ok.css'])
		).rejects.toThrow(/canonical/)
		expect(del).not.toHaveBeenCalled()
	})
})

describe('listRemoteFilesRecursive', () => {
	it('walks nested directories and returns "./"-prefixed file paths', async () => {
		const list = vi.fn(async (dir: string) => {
			if (dir === '/root') {
				return [
					{ type: 'd', name: 'a' },
					{ type: '-', name: 'top.txt' }
				]
			}
			if (dir === '/root/a') {
				return [{ type: '-', name: 'nested.txt' }]
			}
			throw new Error(`unexpected list(${dir})`)
		})
		const client = { list } as unknown as SftpClient
		const files = await listRemoteFilesRecursive(client, '/root', ignore())
		expect(files.sort()).toEqual(['./a/nested.txt', './top.txt'])
	})

	it('never descends into an excluded directory', async () => {
		const list = vi.fn(async (dir: string) => {
			if (dir === '/root') {
				return [
					{ type: 'd', name: 'preview' },
					{ type: '-', name: 'top.txt' }
				]
			}
			throw new Error(`should not list excluded directory: ${dir}`)
		})
		const client = { list } as unknown as SftpClient
		const matcher = ignore().add('preview/')
		const files = await listRemoteFilesRecursive(client, '/root', matcher)
		expect(files).toEqual(['./top.txt'])
	})

	it('treats a failed listing of the root as an empty remote', async () => {
		const list = vi.fn().mockRejectedValue(new Error('No such directory'))
		const client = { list } as unknown as SftpClient
		const files = await listRemoteFilesRecursive(client, '/preview/brand-new', ignore())
		expect(files).toEqual([])
	})
})
