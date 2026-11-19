import { createMcpHandler } from '@modelcontextprotocol/server'
import { configuration } from '../config/index.js'
import { createNotesMcp } from '../../shared/mcp.js'
import { authorizeMcp } from './oauth.js'
import { integrationCall } from './integrations.js'
import { successResponse, errorResponse } from '../utils/responseHandler.js'
import logger from '../utils/logger.js'

export const notesMcpHandler = (db, token) => createMcpHandler(() => createNotesMcp(async (action, values) => {
	try {
		const actor = await authorizeMcp(db, token)
		const data = await integrationCall(db, actor, action, values)
		return { content: [{ type: 'text', text: JSON.stringify(successResponse(data)) }], isError: false }
	} catch (error) {
		const validation = ['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)
		if (!error.publicCode && !validation) logger.error('MCP operation failed')
		return { content: [{ type: 'text', text: JSON.stringify(errorResponse(error.publicCode || (validation ? 'invalidInput' : 'serverError'))) }], isError: true }
	}
}, configuration().baseURL), { maxSubscriptions: 0, onerror: () => logger.error('MCP protocol request failed'), maxRequestBodySize: 20 * 1024 * 1024 })
