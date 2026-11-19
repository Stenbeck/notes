import Turndown from 'turndown'

export const htmlToMarkdown = (html) => {
	const converter = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced', emDelimiter: '*' })
	converter.addRule('strikethrough', {
		filter: ['del', 's', 'strike'],
		replacement: (content) => content ? `~~${content}~~` : ''
	})
	converter.addRule('tasks', {
		filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
		replacement: (content, node) => {
			const checked = node.getAttribute('data-checked') === 'true'
			const body = node.querySelector('div')
			const text = (body ? converter.turndown(body.innerHTML) : content).trim().replace(/\n/g, '\n  ')
			return `\n- [${checked ? 'x' : ' '}] ${text}\n`
		}
	})
	converter.addRule('attachments', {
		filter: (node) => node.nodeName === 'A' && node.hasAttribute('data-attachment'),
		replacement: (content, node) => `\n\n[${content}](${node.getAttribute('href')})\n\n`
	})
	converter.addRule('tables', {
		filter: 'table',
		replacement: (content, node) => {
			const rows = Array.from(node.querySelectorAll('tr')).map((row) => Array.from(row.children).filter((cell) => ['TD', 'TH'].includes(cell.nodeName)))
			if (!rows.length) return ''
			const width = Math.max(...rows.map((row) => row.length))
			const format = (cells) => `| ${Array.from({ length: width }, (_, index) => cells[index] || '').join(' | ')} |`
			const values = rows.map((row) => row.map((cell) => converter.turndown(cell.innerHTML).trim().replace(/\|/g, '\\|').replace(/[ \t]*\n+/g, '<br>')))
			const hasHeader = rows[0].some((cell) => cell.nodeName === 'TH')
			const header = hasHeader ? values.shift() : []
			return `\n\n${[format(header), format(Array(width).fill('---')), ...values.map(format)].join('\n')}\n\n`
		}
	})
	return converter.turndown(html).trim()
}
