import { configuration } from '../config/index.js'
import { models } from '../models/index.js'
import { createHash, randomUUID } from 'node:crypto'
import { posix } from 'node:path'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import MarkdownIt from 'markdown-it'
import { generateJSON, generateHTML } from '@tiptap/html/server'
import Turndown from 'turndown'
import { extensions, schema } from '../../shared/editor/schema.js'
import { readWorkspace } from './workspace.js'
import { structureOperation } from './operations.js'
import { createDocument } from './documents.js'
import { descendants, ancestors } from '../../shared/utils/structure.js'
import { storage } from './storage.js'
import { fail } from '../utils/publicError.js'
const markdown = new MarkdownIt({ html: false })
const turndown = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
const safeFiles = (bytes) => {
	if (bytes.length > 50 * 1024 * 1024) fail('archiveTooLarge', 413)
	let count = 0
	let size = 0
	return unzipSync(bytes, {
		filter: (file) => {
			count++
			size += file.originalSize
			if (
				count > 10000 ||
				size > 200 * 1024 * 1024 ||
				file.name.startsWith('/') ||
				file.name.includes('\\') ||
				file.name.split('/').includes('..')
			)
				fail('unsafeArchive')
			return !file.name.startsWith('__MACOSX/') && !posix.basename(file.name).startsWith('._')
		}
	})
}
const aliases = {
	strong: 'bold',
	em: 'italic',
	br: 'hardBreak',
	hr: 'horizontalRule',
	tr: 'tableRow',
	td: 'tableCell',
	th: 'tableHeader',
	bullet_list: 'bulletList',
	ordered_list: 'orderedList',
	list_item: 'listItem',
	checkbox_list: 'taskList',
	checkbox_item: 'taskItem',
	code_block: 'codeBlock',
	hard_break: 'hardBreak',
	horizontal_rule: 'horizontalRule',
	table_row: 'tableRow',
	table_cell: 'tableCell',
	table_header: 'tableHeader',
	code_inline: 'code'
}
const normalizeJSON = (json, warnings, attachments = []) => {
	const known = schema()
	const walk = (node) => {
		if (!node || typeof node !== 'object') return []
		if (node.type === 'mention' && typeof node.attrs?.href === 'string' && node.attrs.href) {
			return [{
				type: 'text',
				text: node.attrs.label || node.attrs.href,
				marks: [{ type: 'link', attrs: { href: node.attrs.href } }]
			}]
		}
		if (node.type === 'embed' && typeof node.attrs?.href === 'string' && node.attrs.href)
			return [{ type: 'paragraph', content: [{ type: 'text', text: node.attrs.href, marks: [{ type: 'link', attrs: { href: node.attrs.href } }] }] }]
		const type = aliases[node.type] || node.type
		const children = (node.content || []).flatMap(walk)
		if (!known.nodes[type]) {
			warnings.push(`Unsupported block: ${node.type}`)
			return children
		}
		const result = { ...node, type, ...(node.content ? { content: children } : {}) }
		if (type === 'attachment') {
			const attachment = attachments.find((a) =>
				a.id === node.attrs?.id ||
				(typeof node.attrs?.href === 'string' && node.attrs.href.includes(a.id))
			)
			result.attrs = {
				...node.attrs,
				id: attachment?.id || node.attrs?.id,
				name: node.attrs?.name || node.attrs?.title || attachment?.name || 'File'
			}
		}
		if (node.marks)
			result.marks = node.marks
				.map((m) => ({ ...m, type: aliases[m.type] || m.type }))
				.filter((m) => known.marks[m.type])
		if (['paragraph', 'heading'].includes(type) && children.some((child) => known.nodes[child.type].isBlock)) {
			// Outline permits inline media; Notes keeps media as separate blocks.
			const blocks = []
			let inline = []
			const flush = () => {
				if (inline.length) blocks.push({ ...result, content: inline })
				inline = []
			}
			for (const child of children) {
				if (known.nodes[child.type].isBlock) {
					flush()
					blocks.push(child)
				} else inline.push(child)
			}
			flush()
			return blocks
		}
		if (['listItem', 'taskItem'].includes(type) && children[0]?.type !== 'paragraph')
			result.content = [{ type: 'paragraph' }, ...children]
		return [result]
	}
	const jsonDoc = walk(json)[0] || { type: 'doc', content: [] }
	try {
		const doc = known.nodeFromJSON(jsonDoc)
		doc.check()
		return doc.toJSON()
	} catch {
		warnings.push('Block structure normalized to text')
		const readable = (node) => [node.text || '', ...(node.content || []).map(readable)].filter(Boolean).join('\n')
		const text = readable(jsonDoc)
		return {
			type: 'doc',
			content: [{ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) }]
		}
	}
}
export const parseArchive = (bytes) => {
	const files = safeFiles(bytes)
	let entries = [],
		projects = [],
		attachments = [],
		warnings = []
	if (files['notes.json']) {
		const payload = JSON.parse(strFromU8(files['notes.json']))
		if (payload.format !== 'notes' || payload.version !== 1) fail('unsupportedImport')
		return {
			files,
			entries: (payload.documents || []).map((e) =>
				payload.contentFormat === 'markdown' && e.path && files[e.path]
					? { ...e, json: undefined, markdown: strFromU8(files[e.path]).replace(/^#\s+[^\n]+\n+/, '') }
					: e
			),
			projects: payload.projects || [],
			attachments: payload.attachments || [],
			warnings
		}
	}
	for (const [path, data] of Object.entries(files)) {
		if (!/\.json$/i.test(path) || posix.basename(path) === 'metadata.json') continue
		let value
		try {
			value = JSON.parse(strFromU8(data))
		} catch {
			warnings.push(`Invalid JSON: ${path}`)
			continue
		}
		if (value.collection && value.documents) {
			const c = value.collection
			projects.push({
				id: c.id,
				title: c.name || c.title || path,
				description: typeof c.description === 'string' ? c.description : '',
				icon: 'Folder',
				color: c.color
			})
			const order = new Map()
			const walk = (nodes, parentId = null) =>
				(nodes || []).forEach((n, i) => {
					order.set(n.id, { order: i, parentId })
					walk(n.children, n.id)
				})
			walk(c.documentStructure)
			for (const item of Object.values(value.documents))
				entries.push({
					id: item.id,
					urlId: item.urlId,
					title: item.title,
					parentId: order.get(item.id)?.parentId ?? item.parentDocumentId,
					order: order.get(item.id)?.order ?? entries.length,
					projectId: c.id,
					json: item.data
				})
			for (const item of Object.values(value.attachments || {}))
				attachments.push({
					id: item.id,
					path: files[posix.join(posix.dirname(path), item.key)]
						? posix.join(posix.dirname(path), item.key)
						: item.key,
					name: item.name || item.key.split('/').pop(),
					documentId: item.documentId,
					type: item.contentType
				})
		} else {
			const candidates = Array.isArray(value)
				? value
				: Array.isArray(value.documents)
					? value.documents
					: [value]
			for (const item of candidates)
				if (item.title && (item.text !== undefined || item.content || item.data))
					entries.push({
						id: item.id || path,
						title: item.title,
						parentId: item.parentDocumentId || null,
						projectId: item.collectionId || 'Outline',
						markdown: item.text,
						json: item.content || item.data
					})
		}
	}
	if (!entries.length) {
		entries = Object.entries(files)
			.filter(([path]) => /\.md$/i.test(path))
			.map(([path, data]) => {
				const text = strFromU8(data)
				return {
					id: path,
					title: text.match(/^#\s+(.+)/)?.[1] || path.split('/').pop().replace(/\.md$/i, ''),
					path,
					projectId: path.includes('/') ? path.split('/')[0] : 'Outline',
					markdown: text.replace(/^#\s+[^\n]+\n+/, '')
				}
			})
		for (const entry of entries) {
			const folder = posix.dirname(entry.path)
			entry.parentId = entries.find((e) => e.path.replace(/\.md$/i, '') === folder)?.id || null
		}
		attachments = Object.entries(files)
			.filter(([path]) => !path.endsWith('/') && !/\.(md|json)$/i.test(path))
			.map(([path]) => ({ id: path, path, name: path.split('/').pop() }))
	}
	for (const id of new Set(entries.map((e) => e.projectId || 'Outline')))
		if (!projects.some((p) => p.id === id)) projects.push({ id, title: String(id) })
	if (!entries.length) fail('emptyImport')
	if (new Set(entries.map((e) => e.id)).size !== entries.length) fail('invalidInput')
	return { files, entries, projects, attachments, warnings }
}
const checkAttachmentSizes = ({ files, attachments }) => {
	const maxFileSize = configuration().maxFileSize
	if (attachments.some((attachment) => files[attachment.path]?.length > maxFileSize))
		fail('attachmentTooLarge', 413)
}
export const previewImport = (bytes) => {
	const parsed = parseArchive(bytes)
	checkAttachmentSizes(parsed)
	return {
		files: Object.keys(parsed.files).length,
		documents: parsed.entries.length,
		attachments: parsed.attachments.length,
		warnings: parsed.warnings
	}
}
export const importArchive = async (db, bytes, { includeIds = false, jobId } = {}) => {
	const parsed = parseArchive(bytes)
	checkAttachmentSizes(parsed)
	const { files, entries, projects, attachments, warnings } = parsed
	const importId = (kind, key) => {
		if (!jobId) return randomUUID()
		const hex = createHash('sha256').update(JSON.stringify([jobId, kind, key])).digest('hex')
		return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-')
	}
	const ids = new Map([...projects, ...entries].map((e) => [e.id, importId('node', e.id)]))
	const attachmentIds = new Map(attachments.map((a) => [a.id, importId('attachment', a.id)]))
	const referenced = new Map()
	const rewrite = (value, entry) => {
		if (Array.isArray(value)) return value.map((v) => rewrite(v, entry))
		if (!value || typeof value !== 'object') return value
		if (value.type === 'image' && typeof value.attrs?.src === 'string' && !/^(https?:|data:)/i.test(value.attrs.src)) {
			const source = value.attrs.src
			const path = posix.normalize(posix.join(posix.dirname(entry.path || ''), decodeURIComponent(source.split('#')[0])))
			if (!attachments.some((a) => source.includes(a.id) || source === a.path || path === a.path))
				return { type: 'missingAttachment', attrs: { name: value.attrs.alt || value.attrs.title || posix.basename(source) } }
		}
		const result = {}
		for (const [key, item] of Object.entries(value)) {
			if (['href', 'src'].includes(key) && typeof item === 'string') {
				const decoded = decodeURIComponent(item.split('#')[0])
				const doc = entries.find(
					(e) =>
						item === `/d/${e.id}` ||
						(e.urlId && item.split('#')[0].endsWith(e.urlId)) ||
						(e.path && posix.normalize(posix.join(posix.dirname(entry.path || ''), decoded)) === e.path)
				)
				const a = attachments.find(
					(a) =>
						item.includes(a.id) ||
						item === a.path ||
						posix.normalize(posix.join(posix.dirname(entry.path || ''), decoded)) === a.path
				)
				if (doc) result[key] = `/d/${ids.get(doc.id)}`
				else if (a) {
					result[key] = `/api/files/${attachmentIds.get(a.id)}`
					if (!referenced.has(a.id)) referenced.set(a.id, entry.id)
				} else result[key] = item
			} else if (key === 'id' && attachmentIds.has(item)) result[key] = attachmentIds.get(item)
			else result[key] = rewrite(item, entry)
		}
		return result
	}
	const normalized = entries.map((e) => ({
		...e,
		json: rewrite(
			normalizeJSON(
				e.json || generateJSON(markdown.render(String(e.markdown || '')), extensions()),
				warnings,
				attachments
			),
			e
		)
	}))
	// Validate and topologically sort before writing any import data.
	const pending = [...normalized].sort((a, b) => (a.order || 0) - (b.order || 0)),
		ordered = [],
		seen = new Set(projects.map((p) => p.id))
	while (pending.length) {
		const index = pending.findIndex((e) => !e.parentId || seen.has(e.parentId) || !ids.has(e.parentId))
		if (index < 0) fail('cycle')
		const e = pending.splice(index, 1)[0]
		ordered.push(e)
		seen.add(e.id)
	}
	for (const p of projects) {
		const id = ids.get(p.id)
		await structureOperation(
			db,
			{ type: 'project.create', id, title: p.title, operationId: importId('create-project', p.id) },
			{ type: 'owner' }
		)
		await structureOperation(
			db,
			{
				type: 'node.update',
				id,
				description: p.description || '',
				icon: p.icon || 'Folder',
				color: p.color || '#655277',
				operationId: importId('update-project', p.id)
			},
			{ type: 'owner' }
		)
	}
	for (const e of ordered) {
		const id = ids.get(e.id)
		await createDocument(db, id, e.json)
		await structureOperation(
			db,
			{
				type: 'document.create',
				id,
				title: e.title,
				parentId: ids.get(e.parentId) || ids.get(e.projectId) || null,
				operationId: importId('create-document', e.id)
			},
			{ type: 'owner' }
		)
	}
	let importedAttachments = 0
	for (const a of attachments) {
		const data = files[a.path]
		const documentId = ids.get(a.documentId || referenced.get(a.id))
		if (!data || !documentId) {
			warnings.push(`Attachment not imported: ${a.name}`)
			continue
		}
		const id = attachmentIds.get(a.id)
		if (jobId && await models(db).Attachment.exists({ _id: id })) {
			importedAttachments++
			continue
		}
		await storage().put(id, data, { replace: !!jobId })
		await models(db).Attachment.create({
			_id: id,
			documentId,
			name: a.name,
			type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'].includes(a.type)
				? a.type
				: 'application/octet-stream',
			size: data.length
		})
		importedAttachments++
	}
	return {
		imported: entries.length, warnings, attachments: importedAttachments,
		...(includeIds ? { documentIds: entries.map((entry) => ids.get(entry.id)), projectIds: projects.map((project) => ids.get(project.id)) } : {})
	}
}
export const exportArchive = async (db, { id, format = 'json' } = {}) => {
	const ws = await readWorkspace(db)
	const allowed = id ? new Set([id, ...descendants(ws, id)]) : new Set(Object.keys(ws.nodes))
	const nodes = Object.values(ws.nodes).filter((n) => allowed.has(n.id))
	const filePart = (n) =>
		`${
			n.title
				.replace(/[^\p{L}\p{N}_ -]/gu, '')
				.trim()
				.slice(0, 70) || 'document'
		}--${n.id}`
	const documentPath = (n) =>
		[
			...ancestors(ws, n.id)
				.filter((parent) => allowed.has(parent.id))
				.slice(0, -1)
				.map(filePart),
			`${filePart(n)}.md`
		].join('/')
	const documents = [],
		attachments = [],
		files = {}
	for (const n of nodes.filter((n) => n.kind === 'document')) {
		const row = await models(db).Document.findOne({ _id: n.id }).lean()
		if (!row) continue
		documents.push({
			id: n.id,
			title: n.title,
			parentId: allowed.has(n.parentId) ? n.parentId : null,
			projectId: nodes.find((p) => p.kind === 'project' && descendants(ws, p.id).includes(n.id))?.id,
			...(format === 'markdown' ? { path: documentPath(n) } : { json: row.json }),
			order: n.order
		})
		if (format === 'markdown') {
			let text = turndown.turndown(generateHTML(row.json, extensions()))
			for (const target of nodes.filter((n) => n.kind === 'document'))
				text = text
					.split(`/d/${target.id}`)
					.join(posix.relative(posix.dirname(documentPath(n)), documentPath(target)))
			text = text.replaceAll(
				'/api/files/',
				`${posix.relative(posix.dirname(documentPath(n)), 'attachments')}/`
			)
			files[documentPath(n)] = strToU8(`# ${n.title}\n\n${text}`)
		}
		for (const a of await models(db).Attachment.find({ documentId: n.id, deletedAt: null }).lean()) {
			const path = `attachments/${a._id}`
			files[path] = await storage().get(a._id)
			attachments.push({ id: a._id, documentId: n.id, name: a.name, type: a.type, path })
		}
	}
	files['notes.json'] = strToU8(
		JSON.stringify(
			{
				format: 'notes',
				version: 1,
				contentFormat: format,
				projects: nodes
					.filter((n) => n.kind === 'project')
					.map(({ id, title, description, icon, color, order }) => ({
						id,
						title,
						description,
						icon,
						color,
						order
					})),
				documents,
				attachments
			},
			null,
			2
		)
	)
	return Buffer.from(zipSync(files))
}
