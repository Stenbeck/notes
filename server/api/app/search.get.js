import { ownerHandler } from '../../utils/ownerHandler.js'
import { searchDocuments } from '../../services/operations.js'
export default ownerHandler((event, db, actor) => {
	const query = getQuery(event)
	return searchDocuments(db, query.q, actor, query.inactive === 'true')
})
