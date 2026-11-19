import { Schema } from 'mongoose'
import { modelOptions } from './options.js'

const embedded = { _id: false, strict: 'throw' }
const shareSchema = new Schema(
	{
		id: { type: String, required: true },
		slug: { type: String, required: true },
		version: { type: Number, required: true },
		passwordHash: String
	},
	embedded
)
const nodeSchema = new Schema(
	{
		id: { type: String, required: true },
		kind: { type: String, enum: ['project', 'document'], required: true },
		title: { type: String, default: 'Untitled' },
		description: String,
		icon: String,
		color: String,
		parentId: { type: String, default: null },
		order: { type: Number, required: true },
		status: { type: String, enum: ['active', 'archive', 'trash'], required: true },
		createdAt: { type: String, required: true },
		updatedAt: { type: String, required: true },
		mcpEnabled: Boolean,
		apiEnabled: Boolean,
		starred: Boolean,
		share: shareSchema
	},
	embedded
)
export const workspaceSchema = new Schema(
	{
		_id: { type: String, required: true },
		revision: { type: Number, required: true, min: 0 },
		projects: [String],
		nodes: { type: Map, of: nodeSchema, default: {} },
		operations: [new Schema({ id: String, at: Number }, embedded)],
		settings: { apiEnabled: { type: Boolean, default: false }, mcpEnabled: { type: Boolean, default: false } },
		preferences: {
			theme: { type: String, enum: ['notes', 'mood', 'offlist'] },
			appearance: { type: String, enum: ['light', 'dark', 'system'] },
			locale: { type: String, enum: ['sv', 'en'] },
			dateFormat: { type: String, enum: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy'] },
			timeFormat: { type: String, enum: ['24h', '12h'] },
			sidebarWidth: { type: Number, min: 179, max: 560 }
		}
	},
	modelOptions
)
