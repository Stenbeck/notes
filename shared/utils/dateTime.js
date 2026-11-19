export const dateFormats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy']
export const timeFormats = ['24h', '12h']
export const formatDateTime = (value, preferences = {}, includeTime = true) => {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return ''
	const year = String(date.getFullYear())
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const pattern = dateFormats.includes(preferences.dateFormat) ? preferences.dateFormat : 'yyyy-MM-dd'
	const formatted = pattern.replace('yyyy', year).replace('MM', month).replace('dd', day)
	if (!includeTime) return formatted
	const hour = date.getHours()
	const minute = String(date.getMinutes()).padStart(2, '0')
	const time = preferences.timeFormat === '12h'
		? `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`
		: `${String(hour).padStart(2, '0')}:${minute}`
	return `${formatted} ${time}`
}
