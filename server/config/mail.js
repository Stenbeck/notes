import { fail } from '../utils/publicError.js'

export const mailConfiguration = () => {
	if (!process.env.SMTP_HOST || !process.env.SMTP_FROM_EMAIL) fail('smtpConfiguration', 503)
	return {
		from: {
			address: process.env.SMTP_FROM_EMAIL,
			name: process.env.SMTP_FROM_NAME || 'Notes'
		},
		transport: {
			host: process.env.SMTP_HOST,
			port: Number(process.env.SMTP_PORT || 587),
			secure: process.env.SMTP_SECURE === 'true',
			...(process.env.SMTP_USER
				? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
				: {})
		}
	}
}
