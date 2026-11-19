import { models } from '../server/models/index.js'
import { database } from '../server/services/database.js'
try {
	const db = await database()
	const hello = await db.command({ hello: 1 })
	const info = await db.command({ buildInfo: 1 })
	await models(db).Installation.findOne({ _id: 'owner' }, { _id: 1 }).lean()
	process.stdout.write(
		`MongoDB ${info.version}: ${hello.setName ? 'replica set' : 'standalone'}, read access OK. No data changed.\n`
	)
} catch {
	process.stderr.write('Database check failed. Check connection, TLS and database permissions.\n')
	process.exitCode = 1
}
process.exit(process.exitCode || 0)
