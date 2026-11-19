import { models } from '../models/index.js'
import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { sendMail } from './mail.js'
import { configuration } from '../config/index.js'
import { fail } from '../utils/publicError.js'
import { digest } from '../utils/crypto.js'
export const issueSetup = async (db) => {
	const token = randomBytes(32).toString('hex')
	const existing = await models(db).Installation.findOne({ _id: 'owner' }).lean()
	if (existing?.complete) fail('setupClosed', 409)
	await models(db).Installation.updateOne(
		{ _id: 'setup' },
		{ $set: { hash: digest(token), expiresAt: new Date(Date.now() + 1800000) } },
		{ runValidators: true, upsert: true }
	)
	return token
}
export const beginSetup = async (db, { token, email, name }) => {
	if (
		typeof token !== 'string' ||
		typeof email !== 'string' ||
		typeof name !== 'string' ||
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
		!name.trim()
	)
		fail('invalidInput')
	const setup = await models(db)
		.Installation.findOne({ _id: 'setup', hash: digest(token), expiresAt: { $gt: new Date() } })
		.lean()
	if (!setup) fail('invalidToken', 403)
	const normalized = email.trim().toLowerCase()
	const challenge = randomBytes(32).toString('hex')
	const userId = new ObjectId()
	try {
		await models(db).Installation.create({
			_id: 'owner',
			complete: false,
			email: normalized,
			name: name.trim().slice(0, 100),
			userId: String(userId),
			challengeHash: digest(challenge),
			challengeExpires: new Date(Date.now() + 1800000)
		})
	} catch (error) {
		if (error.code !== 11000) throw error
		const owner = await models(db).Installation.findOne({ _id: 'owner' }).lean()
		if (owner.complete || owner.email !== normalized) fail('setupReserved', 409)
		await models(db).Installation.updateOne(
			{ _id: 'owner', complete: false, email: normalized },
			{ $set: { challengeHash: digest(challenge), challengeExpires: new Date(Date.now() + 1800000) } },
			{ runValidators: true }
		)
	}
	await sendMail({
		to: normalized,
		subject: 'Notes: verify your email',
		text: `${configuration().baseURL}/setup#verify=${challenge}\n\nVerify your email within 30 minutes.`
	})
	return { sent: true }
}
export const verifySetup = async (db, token) => {
	if (typeof token !== 'string') fail('invalidToken')
	const owner = await models(db)
		.Installation.findOne({
			_id: 'owner',
			complete: false,
			challengeHash: digest(token),
			challengeExpires: { $gt: new Date() }
		})
		.lean()
	if (!owner) fail('invalidToken', 403)
	await db.collection('user').updateOne(
		{ _id: new ObjectId(owner.userId) },
		{
			$setOnInsert: {
				name: owner.name,
				email: owner.email,
				emailVerified: true,
				createdAt: new Date(),
				updatedAt: new Date()
			}
		},
		{ upsert: true }
	)
	const completed = await models(db).Installation.updateOne(
		{ _id: 'owner', complete: false, challengeHash: digest(token) },
		{ $set: { complete: true }, $unset: { challengeHash: '', challengeExpires: '' } },
		{ runValidators: true }
	)
	if (!completed.modifiedCount) fail('invalidToken', 403)
	await models(db).Installation.deleteOne({ _id: 'setup' })
	return { verified: true, userId: owner.userId }
}

export const setupStatus = async (db) => ({
	complete: !!(await models(db).Installation.findOne({ _id: 'owner' }).lean())?.complete
})
