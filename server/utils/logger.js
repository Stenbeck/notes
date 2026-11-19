// Callers pass fixed operational messages, never request content or error objects.
const write = (stream, level, message) => stream.write(`${JSON.stringify({ level, message })}\n`)
const logger = {
	error: (message) => write(process.stderr, 'error', message),
	debug: (message) => {
		if (process.env.NODE_ENV === 'development') write(process.stdout, 'debug', message)
	}
}
export default logger
