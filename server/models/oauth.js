import { Schema } from 'mongoose'
import { modelOptions } from './options.js'

export const oauthClientSchema = new Schema({
	_id: { type: String, required: true },
	name: { type: String, required: true },
	redirectUris: { type: [String], required: true }
}, { ...modelOptions, timestamps: true })

export const oauthCodeSchema = new Schema({
	_id: { type: String, required: true },
	clientId: String,
	redirectUri: String,
	challenge: String,
	resource: String,
	tokenId: String,
	expiresAt: Date
}, modelOptions)
oauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const oauthGrantSchema = new Schema({
	_id: { type: String, required: true },
	clientId: String,
	resource: String,
	tokenId: String,
	accessHash: String,
	accessExpiresAt: Date,
	refreshHash: String,
	expiresAt: Date
}, modelOptions)
oauthGrantSchema.index({ accessHash: 1 }, { unique: true })
oauthGrantSchema.index({ refreshHash: 1 }, { unique: true })
oauthGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
