import nodemailer from 'nodemailer'
import { mailConfiguration } from '../config/mail.js'

export const sendMail = async ({ to, subject, text }) => {
	const { from, transport } = mailConfiguration()
	await nodemailer.createTransport(transport).sendMail({ from, to, subject, text })
}
