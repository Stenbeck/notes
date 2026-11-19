import { scrypt, argon2, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const deriveScrypt = promisify(scrypt)
const deriveArgon2 = promisify(argon2)
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }
const matches = (actual, expected) => actual.length === expected.length && timingSafeEqual(actual, expected)

export const hashPassword = async (password) => {
	const salt = randomBytes(16)
	const key = await deriveScrypt(password, salt, 32, options)
	return `scrypt$v=1$${salt.toString('hex')}$${key.toString('hex')}`
}
export const verifyPassword = async (encoded, password) => {
	if (typeof encoded !== 'string' || typeof password !== 'string' || password.length > 200) return false
	const current = /^scrypt\$v=1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded)
	if (current) {
		const key = await deriveScrypt(password, Buffer.from(current[1], 'hex'), 32, options)
		return matches(key, Buffer.from(current[2], 'hex'))
	}
	// These fixed parameters match the previous implementation. New hashes use scrypt.
	const legacy = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(encoded)
	if (!legacy) return false
	const key = await deriveArgon2('argon2id', {
		message: password,
		nonce: Buffer.from(legacy[1], 'base64'),
		parallelism: 1,
		tagLength: 32,
		memory: 19456,
		passes: 2
	})
	return matches(key, Buffer.from(legacy[2], 'base64'))
}
