import { ownerHandler } from '../../utils/ownerHandler.js'
import { saveAvatar } from '../../services/avatar.js'
import { getAuth } from '../../services/auth.js'
import { fail } from '../../utils/publicError.js'
import { randomUUID } from 'node:crypto'

export default ownerHandler(async (event, db) => {
	if (Number(getHeader(event, 'content-length')) > 600 * 1024) fail('avatarInvalid')
	const parts = await readMultipartFormData(event)
	await saveAvatar(db, parts?.find((part) => part.filename))
	const image = `/api/app/avatar?v=${randomUUID()}`
	await (await getAuth()).api.updateUser({ body: { image }, headers: new Headers(event.node.req.headers) })
	return { image }
})
