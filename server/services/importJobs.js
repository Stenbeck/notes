import { createHash } from 'node:crypto'
import { importArchive } from './portability.js'
import { fail } from '../utils/publicError.js'

const active = new Map()
const jobs = db => db.collection('importJobs')
const validate = id => {
	if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) fail('invalidInput')
}
export const importStatus = async (db, id) => {
	validate(id)
	const job = await jobs(db).findOne({ _id: id })
	if (!job) return { status: 'missing' }
	if (job.result) return { status: 'complete', result: job.result }
	return { status: active.has(id) ? 'running' : 'interrupted' }
}

export const runImportJob = async (db, id, bytes) => {
	validate(id)
	const hash = createHash('sha256').update(bytes).digest('hex')
	const running = active.get(id)
	if (running) {
		if (running.hash !== hash) fail('importArchiveMismatch', 409)
		return running.task
	}
	const task = (async () => {
		await jobs(db).updateOne({ _id: id }, { $setOnInsert: { hash, createdAt: new Date() } }, { upsert: true })
		const job = await jobs(db).findOne({ _id: id })
		if (job.hash !== hash) fail('importArchiveMismatch', 409)
		if (job.result) return job.result
		const result = await importArchive(db, bytes, { includeIds: true, jobId: id })
		await jobs(db).updateOne({ _id: id }, { $set: { result } })
		return result
	})()
	active.set(id, { hash, task })
	try {
		return await task
	} finally {
		active.delete(id)
	}
}
