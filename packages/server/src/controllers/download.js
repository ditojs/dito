import { NotFoundError } from '../errors/index.js'

// Controllers with `downloads` serve the files of their members by key, as
// files of private storages have no `url`. Keys that the member's asset
// properties don't hold respond with 404.
export async function sendMemberFile(ctx, { member }) {
  const { modelClass } = this.controller
  const { assets } = modelClass.definition
  const key = decodeKey(ctx.params.key)
  const entry = modelClass
    ._getAssetFiles(member)
    .find(({ file }) => file.key === key)
  if (!entry) {
    throw new NotFoundError()
  }
  // Read through the storage, as `member.get` overrides can return plain data:
  const { file, dataPath } = entry
  const data = await this.app
    .getStorage(assets[dataPath].storage)
    .readFile(file)
  ctx.type = file.type
  ctx.attachment(file.name)
  ctx.body = data
}

// Keys can hold any characters of the file's extension, which clients encode:
function decodeKey(key) {
  try {
    return decodeURIComponent(key)
  } catch {
    return null
  }
}
