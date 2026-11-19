import { Schema } from 'mongoose'
import { modelOptions } from './options.js'

// Setup token and owner reservation share the existing installation collection.
export const installationSchema = new Schema(
	{
		_id: { type: String, enum: ['setup', 'owner'], required: true },
		hash: String,
		expiresAt: Date,
		complete: Boolean,
		email: String,
		name: String,
		userId: String,
		avatar: Buffer,
		avatarType: String,
		challengeHash: String,
		challengeExpires: Date
	},
	modelOptions
)
