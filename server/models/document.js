import { Schema } from 'mongoose'
import { modelOptions } from './options.js'

export const documentSchema = new Schema(
	{
		_id: { type: String, required: true },
		revision: { type: Number, required: true, min: 0 },
		state: { type: Buffer, required: true },
		// Tiptap validates the recursive editor format before persistence.
		json: { type: Schema.Types.Mixed, required: true },
		text: { type: String, default: '' }
	},
	{ ...modelOptions, timestamps: true }
)
documentSchema.index({ updatedAt: 1 })
