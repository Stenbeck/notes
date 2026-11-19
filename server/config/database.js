import { fail } from '../utils/publicError.js'

export const databaseConfiguration = () => {
	const uri = process.env.MONGODB_URI
	if (!uri) fail('databaseConfiguration', 503)
	const tls = process.env.MONGODB_TLS_CA_FILE
	return {
		uri,
		options: {
			...(tls
				? {
						tls: true,
						tlsCAFile: tls,
						tlsAllowInvalidCertificates: false,
						tlsAllowInvalidHostnames: false,
						...(process.env.MONGODB_TLS_SERVER_NAME
							? { servername: process.env.MONGODB_TLS_SERVER_NAME }
							: {})
					}
				: {}),
			maxPoolSize: 10,
			serverSelectionTimeoutMS: 5000
		}
	}
}
