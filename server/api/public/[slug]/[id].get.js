import { publicHandler } from '../../../utils/publicHandler.js'
import { readPublicDocument } from '../../../services/public.js'

export default publicHandler((event, db) =>
	readPublicDocument(db, event.context.params.slug, event.context.params.id, parseCookies(event))
)
