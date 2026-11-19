import { resolve, join } from 'node:path'
import { mkdir, writeFile, readFile, rename, rm } from 'node:fs/promises'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { configuration } from '../config/index.js'
import { fail } from '../utils/publicError.js'
const keyPath = (key) => {
	if (!/^[a-zA-Z0-9_-]{1,120}$/.test(key)) fail('invalidStorageKey')
	return join(resolve(configuration().dataDir, 'attachments'), key)
}
const s3 = () =>
	new S3Client({
		region: process.env.S3_REGION || 'us-east-1',
		endpoint: process.env.S3_ENDPOINT || undefined,
		forcePathStyle: true,
		credentials: {
			accessKeyId: process.env.S3_ACCESS_KEY_ID,
			secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
		}
	})
export const storage = () =>
	process.env.STORAGE_DRIVER === 's3'
		? {
				put: (key, bytes) =>
					s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: bytes })),
				get: async (key) =>
					Buffer.from(
						await (
							await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }))
						).Body.transformToByteArray()
					),
				remove: (key) => s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }))
			}
		: {
				put: async (key, bytes, { replace = false } = {}) => {
					const path = keyPath(key)
					await mkdir(resolve(configuration().dataDir, 'attachments'), { recursive: true })
					if (!replace) return writeFile(path, bytes, { mode: 0o600, flag: 'wx' })
					const temporary = keyPath(randomUUID())
					try {
						await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' })
						await rename(temporary, path)
					} finally {
						await rm(temporary, { force: true })
					}
				},
				get: (key) => readFile(keyPath(key)),
				remove: (key) => rm(keyPath(key), { force: true })
			}
