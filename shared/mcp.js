import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

const fields = {
	recursive: z.boolean().optional(),
	offset: z.number().int().nonnegative().optional(),
	limit: z.number().int().min(1).max(100).optional(),
	id: z.string().optional(),
	parentId: z.string().nullable().optional(),
	title: z.string().optional(),
	query: z.string().optional(),
	json: z.any().optional(),
	baseRevision: z.number().optional(),
	operationId: z.string().optional(),
	index: z.number().optional()
}
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const createFields = z.strictObject({
	parentId: uuid.describe('Existing project or document UUID from notes_projects or notes_read. Use the project UUID to create at the project root.'),
	title: z.string().optional(),
	content: z.string().optional().describe('Initial plain text. Line breaks become paragraphs. Use either content or json.'),
	json: z.object({ type: z.literal('doc'), content: z.array(z.unknown()) }).strict().optional().describe('Initial Tiptap document for rich formatting. Use either json or content.'),
	id: uuid.optional().describe('New document UUID. Leave out to generate it.'),
	operationId: z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/).optional().describe('Optional retry key. Reuse the same key and document UUID when retrying.'),
	index: z.number().int().nonnegative().optional(),
	baseRevision: z.number().int().nonnegative().optional()
})
export const createNotesMcp = (call, websiteUrl) => {
	const server = new McpServer({
		name: 'notes',
		title: 'Notes',
		description: 'Search, read and manage notes in authorized projects.',
		version: '0.1.0',
		...(websiteUrl?.startsWith('https://') ? {
			websiteUrl,
			icons: [{ src: `${websiteUrl}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] }]
		} : {})
	}, { capabilities: { tools: { listChanged: false } } })
	for (const name of ['projects', 'search', 'read', 'create', 'update', 'move', 'rename', 'archive', 'trash']) {
		const readOnly = ['projects', 'search', 'read'].includes(name)
		server.registerTool(`notes_${name}`, {
			description: name === 'create'
				? 'Create a document with its initial content in one call. Pass the existing parent UUID, a title, and either plain-text content or Tiptap json for rich formatting. Omit both for a blank document. Requires write access.'
				: `Notes ${name}. Only explicitly authorized projects are accessible. Structural writes require a unique operationId; content updates require baseRevision.`,
			inputSchema: name === 'create' ? createFields : fields,
			annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false },
			_meta: { securitySchemes: [{ type: 'oauth2', scopes: ['notes'] }] }
		}, values => {
			if (name !== 'create') return call(name, values)
			return call(name, { ...values, id: values.id ?? randomUUID(), operationId: values.operationId ?? randomUUID() })
		})
	}
	return server
}
