let settle
export const useConfirmation = () => {
	const confirmation = useState('notes-confirmation', () => null)
	const ask = (message, options = {}) => {
		if (settle) settle(false)
		confirmation.value = { message, ...options }
		return new Promise((resolve) => { settle = resolve })
	}
	const answer = (value) => {
		confirmation.value = null
		settle?.(value)
		settle = null
	}
	return { confirmation, ask, answer }
}
