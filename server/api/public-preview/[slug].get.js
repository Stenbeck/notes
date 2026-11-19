import { publicHandler } from '../../utils/publicHandler.js'
import { readSharePreview } from '../../services/shares.js'

export default publicHandler((event, db) => {
	const { document } = getQuery(event)
	return readSharePreview(db, event.context.params.slug, typeof document === 'string' ? document : undefined)
})
