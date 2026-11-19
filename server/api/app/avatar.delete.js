import { ownerHandler } from '../../utils/ownerHandler.js'
import { removeAvatar } from '../../services/avatar.js'
import { getAuth } from '../../services/auth.js'

export default ownerHandler(async (event, db) => {
	await (await getAuth()).api.updateUser({ body: { image: null }, headers: new Headers(event.node.req.headers) })
	await removeAvatar(db)
	return { removed: true }
})
