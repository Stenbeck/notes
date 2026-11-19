import { models } from '../models/index.js'
import { MongoClient } from 'mongodb'
import { databaseConfiguration } from '../config/database.js'
let promise
export const database = async () => {
	if (!promise)
		promise = (async () => {
			const { uri, options } = databaseConfiguration()
			const client = new MongoClient(uri, options)
			await client.connect()
			return { db: client.db(), client }
		})().catch((error) => {
			promise = null
			throw error
		})
	return (await promise).db
}
export const migrate = async (db) => {
	await Promise.all(Object.values(models(db)).map((model) => model.createIndexes()))
	await db.collection('user').createIndex({ email: 1 }, { unique: true })
	await db.collection('session').createIndex({ token: 1 }, { unique: true })
	await db.collection('session').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}
export const mongoClient = async () => {
	await database()
	return (await promise).client
}
