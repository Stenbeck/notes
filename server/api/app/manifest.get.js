import { ownerHandler } from '../../utils/ownerHandler.js'
import { manifest } from '../../services/operations.js'
export default ownerHandler(async (event, db, actor) => ({
	...(await manifest(db, actor)),
	user: actor.user
}))
