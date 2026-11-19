import { models } from '../server/models/index.js'
import { ObjectId } from 'mongodb'
import { database, migrate } from '../server/services/database.js'
import { issueSetup } from '../server/services/setup.js'
const db = await database()
await migrate(db)
if (process.argv.includes('--reset-pending')) {
	const pending = await models(db).Installation.findOneAndDelete({ _id: 'owner', complete: false }).lean()
	if (pending?.userId) await db.collection('user').deleteOne({ _id: new ObjectId(pending.userId) })
}
try {
	process.stdout.write(
		`Setup token (30 minutes): ${await issueSetup(db)}\nOpen /setup and paste this token.\n`
	)
} catch (error) {
	process.stderr.write(`${error.publicCode || 'Setup failed'}\n`)
	process.exitCode = 1
}
process.exit(process.exitCode || 0)
