import { Schema } from 'mongoose'
import { modelOptions } from './options.js'

export const tokenSchema = new Schema(
	{
		_id: { type: String, required: true },
		name: { type: String, required: true },
		type: { type: String, enum: ['api', 'mcp'], required: true },
		projects: [String],
		permission: { type: String, enum: ['read', 'write'], required: true },
		hash: { type: String, required: true },
		revoked: Boolean
	},
	{ ...modelOptions, timestamps: true }
)
tokenSchema.index({ hash: 1 }, { unique: true })
