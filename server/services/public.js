import { generateHTML } from '@tiptap/html/server'
import sanitizeHtml from 'sanitize-html'
import { extensions } from '../../shared/editor/schema.js'
import { childrenOf } from '../../shared/utils/structure.js'
import { models } from '../models/index.js'
import { resolveShare, unlockShare, cookieName } from './shares.js'
import { attachmentId, referencedFiles } from '../../shared/utils/attachments.js'
import { configuration } from '../config/index.js'

export const readPublicDocument = async (db, slug, id, cookies) => {
	const result = await resolveShare(db, slug, id, cookies)
	if (result.locked) return { locked: true }
	const { ws, root, node } = result
	const document =
		node.kind === 'document'
			? await models(db).Document.findOne({ _id: node.id }, { json: 1, revision: 1 }).lean()
			: null
	const ids = document ? [...referencedFiles(document.json)] : []
	const available = new Set((await models(db).Attachment.find({ _id: { $in: ids }, deletedAt: null }, { _id: 1 }).lean()).map((file) => file._id))
	const markMissing = (node) => attachmentId(node) && !available.has(attachmentId(node))
		? { type: 'missingAttachment', attrs: { name: node.attrs?.name || node.attrs?.alt || '' } }
		: { ...node, ...(node.content ? { content: node.content.map(markMissing) } : {}) }
	const html = document
		? sanitizeHtml(generateHTML(markMissing(document.json), extensions()), {
				allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'input'],
				allowedAttributes: {
					...sanitizeHtml.defaults.allowedAttributes,
					img: ['src', 'alt', 'width', 'height', 'data-align'],
					input: ['type', 'checked', 'disabled'],
					a: ['href'],
					div: ['data-missing-file', 'class'],
					table: ['style', 'data-borderless'],
					col: ['style'],
					td: ['colspan', 'rowspan', 'style'],
					th: ['colspan', 'rowspan', 'style']
				},
				allowedStyles: {
					table: { width: [/^\d+px$/], 'min-width': [/^\d+px$/] },
					col: { width: [/^\d+px$/], 'min-width': [/^\d+px$/] },
					td: { 'text-align': [/^(left|center|right)$/] },
					th: { 'text-align': [/^(left|center|right)$/] }
				},
				transformTags: {
					img: (tag, attrs) => ({
						tagName: tag,
						attribs: {
							...attrs,
							src: attrs.src?.startsWith('/api/files/')
								? `${attrs.src}?share=${encodeURIComponent(slug)}`
								: ''
						}
					}),
					a: (tag, attrs) => ({
						tagName: tag,
						attribs: {
							...attrs,
							href: attrs.href?.startsWith('/api/files/')
								? `${attrs.href}?share=${encodeURIComponent(slug)}`
								: (attrs.href?.startsWith('/doc/') || attrs.href?.startsWith('/d/'))
									? `/p/${encodeURIComponent(slug)}?document=${encodeURIComponent(attrs.href.replace(/^\/(?:doc|d)\//, ''))}`
									: attrs.href
						}
					})
				}
			})
		: ''
	return {
		locked: false,
		html,
		root: { title: root.title, id: root.id },
		node: { id: node.id, title: node.title, kind: node.kind, description: node.description },
		children: childrenOf(ws, node.id).map((n) => ({ id: n.id, title: n.title })),
		document
	}
}

export const unlockPublicDocument = async (db, slug, password, cookies) => {
	const result = await resolveShare(db, slug, undefined, cookies)
	return {
		name: cookieName(result.policy.id),
		value: await unlockShare(result.policy, password),
		options: {
			httpOnly: true,
			secure: configuration().baseURL.startsWith('https:'),
			sameSite: 'lax',
			maxAge: 3600,
			path: '/'
		}
	}
}
