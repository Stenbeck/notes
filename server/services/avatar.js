import { models } from '../models/index.js'
import { fail } from '../utils/publicError.js'

export const saveAvatar = async (db, part) => {
	if (!part?.data?.length || part.data.length > 512 * 1024) fail('avatarInvalid')
	const bytes = part.data
	const type = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp'
		: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
		: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null
	if (!type) fail('avatarInvalid')
	await models(db).Installation.updateOne({ _id: 'owner', complete: true }, { $set: { avatar: bytes, avatarType: type } }, { runValidators: true })
}
export const readAvatar = async (db) => {
	const owner = await models(db).Installation.findOne({ _id: 'owner', complete: true }, { avatar: 1, avatarType: 1 }).lean()
	if (!owner?.avatar) fail('notFound', 404)
	return { bytes: Buffer.from(owner.avatar.buffer || owner.avatar), type: owner.avatarType }
}
export const removeAvatar = (db) => models(db).Installation.updateOne({ _id: 'owner', complete: true }, { $unset: { avatar: '', avatarType: '' } })
