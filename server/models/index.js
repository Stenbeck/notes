import mongoose from 'mongoose'
import { oauthClientSchema, oauthCodeSchema, oauthGrantSchema } from './oauth.js'
import { documentSchema } from './document.js'
import { workspaceSchema } from './workspace.js'
import { attachmentSchema } from './attachment.js'
import { tokenSchema } from './token.js'
import { installationSchema } from './installation.js'

const connections = new WeakMap()
export const models = (db) => {
	let connection = connections.get(db.client)
	if (!connection) {
		// Reuse the driver's pool, including Better Auth and isolated test databases.
		connection = mongoose.createConnection().setClient(db.client)
		connections.set(db.client, connection)
	}
	const scoped = connection.useDb(db.databaseName, { useCache: true })
	if (!scoped.models.Document) {
		scoped.model('Document', documentSchema, 'documents')
		scoped.model('Workspace', workspaceSchema, 'workspace')
		scoped.model('Attachment', attachmentSchema, 'attachments')
		scoped.model('Token', tokenSchema, 'tokens')
		scoped.model('OAuthClient', oauthClientSchema, 'oauthClients')
		scoped.model('OAuthCode', oauthCodeSchema, 'oauthCodes')
		scoped.model('OAuthGrant', oauthGrantSchema, 'oauthGrants')
		scoped.model('Installation', installationSchema, 'installation')
	}
	return scoped.models
}
