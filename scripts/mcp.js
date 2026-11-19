import { createNotesMcp } from '../shared/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
const base = process.env.NOTES_URL
if (
	!base ||
	(!base.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(base)) ||
	!process.env.NOTES_TOKEN
)
	throw new Error('Configure NOTES_URL and NOTES_TOKEN')
const server = createNotesMcp(async (name, values) => {
	try {
		const response = await fetch(`${base.replace(/\/$/, '')}/api/integration/${name}`, {
			method: 'POST',
			headers: { authorization: `Bearer ${process.env.NOTES_TOKEN}`, 'content-type': 'application/json' },
			body: JSON.stringify(values),
			signal: AbortSignal.timeout(30000)
		})
		const result = await response.json()
		return {
			content: [{ type: 'text', text: JSON.stringify(result) }],
			isError: !response.ok || !result.success
		}
	} catch {
		return {
			content: [{ type: 'text', text: JSON.stringify({ error: 'Request failed' }) }],
			isError: true
		}
	}
})
await server.connect(new StdioServerTransport())
