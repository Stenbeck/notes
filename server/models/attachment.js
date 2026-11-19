import { Schema } from 'mongoose'
import { modelOptions } from './options.js'

export const attachmentSchema = new Schema(
	{
		_id: { type: String, required: true },
		documentId: { type: String, required: true },
		name: { type: String, required: true },
		type: { type: String, required: true },
		size: { type: Number, required: true, min: 0 },
		deletedAt: { type: Date, default: null },
		purgedAt: { type: Date, default: null }
	},
	{ ...modelOptions, timestamps: { createdAt: true, updatedAt: false } }
)
attachmentSchema.index({ documentId: 1 })
