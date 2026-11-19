export const fail = (code, statusCode = 400) => {
	const error = new Error(code)
	error.statusCode = statusCode
	error.publicCode = code
	throw error
}
