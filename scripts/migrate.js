import { database, migrate } from '../server/services/database.js'
await migrate(await database())
process.stdout.write('Indexes ready.\n')
process.exit(0)
