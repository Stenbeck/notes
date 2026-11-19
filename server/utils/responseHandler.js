import logger from './logger.js'
import { fail } from './publicError.js'

export const successResponse = (data) => ({ success: true, data })
export const errorResponse = (error) => ({ success: false, error })
export const withErrorHandling = (action) => async (event) => {
	try {
		return await action(event)
	} catch (error) {
		const validation = ['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)
		setResponseStatus(event, error.publicCode ? error.statusCode : validation ? 400 : 500)
		if (!error.publicCode && !validation) logger.error('Request failed')
		return errorResponse(error.publicCode || (validation ? 'invalidInput' : 'serverError'))
	}
}
export const apiHandler = (action) =>
	defineEventHandler(
		withErrorHandling(async (event) => {
			const data = await action(event)
			return event.handled ? undefined : successResponse(data)
		})
	)
export const rawHandler = (action) => defineEventHandler(withErrorHandling(action))
export const jsonBody = async (event) => {
	const raw = await readRawBody(event)
	if (Buffer.byteLength(raw || '') > 20 * 1024 * 1024) fail('payloadTooLarge', 413)
	try {
		const body = JSON.parse(raw || '{}')
		if (!body || typeof body !== 'object' || Array.isArray(body)) fail('invalidInput')
		return body
	} catch {
		fail('invalidInput')
	}
}
