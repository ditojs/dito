import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import picomatch from 'picomatch'
import { fileTypeFromBuffer } from 'file-type'
import { readMediaAttributes } from 'leather'
import { isString } from '@ditojs/utils'

// The base class of storages. Subclasses write, read, remove and list the
// files in their backend, and `store()` adds what all storages share: unique
// keys, the detection of types and dimensions, sizes and urls.

// A stored file as it appears in JSON data: the storage key, and the name,
// type and size of the file.
export interface AssetFile {
  key: string
  name?: string
  type?: string
  size?: number
  url?: string
  width?: number
  height?: number
}

export interface StorageOptions {
  // The name of the storage, for asset records and error messages.
  name: string
  // The base url of the stored files.
  url?: string
  // Glob patterns of urls, from which files may be imported.
  allowedImports?: string[]
}

export interface StoreOptions {
  name: string
  // Detected from the data when missing.
  type?: string
  data: Buffer
}

export abstract class Storage {
  name: string
  url: string | undefined
  #isAllowedImport: (url: string) => boolean

  constructor({ name, url, allowedImports = [] }: StorageOptions) {
    this.name = name
    this.url = url
    this.#isAllowedImport = picomatch(allowedImports.map(resolveFileUrl))
  }

  isImportSourceAllowed(url: unknown) {
    // Files of storages without `url` have no url to match.
    if (!isString(url)) return false
    const source = getImportSource(url)
    return source !== null && this.#isAllowedImport(source)
  }

  // Stores data under a new key, and returns its file object, with the width
  // and height of images and videos.
  async store({ name, type, data }: StoreOptions): Promise<AssetFile> {
    // Multipart bodies give untyped files `application/octet-stream`, so
    // detect the type of those as well.
    type = (
      (type !== 'application/octet-stream' && type) ||
      (await detectType(data)) ||
      'application/octet-stream'
    )
    const file: AssetFile = {
      key: getUniqueKey(name),
      name,
      type,
      size: data.byteLength,
      ...(/^(image|video)\//.test(type) ? readDimensions(data) : null)
    }
    await this.addFile(file, data)
    const url = this.getFileUrl(file)
    if (url) file.url = url
    return file
  }

  getFileUrl(_file: AssetFile): string | undefined {
    return undefined
  }

  protected getUrl(...parts: string[]) {
    if (!this.url) return undefined
    const file = path.posix.join(...parts)
    // A base url without origin, such as `/assets/`, gives paths.
    return URL.canParse(this.url)
      ? new URL(file, this.url).toString()
      : path.posix.join(this.url, file)
  }

  // Writes the data of the file under its key.
  abstract addFile(file: AssetFile, data: Buffer): Promise<void>
  abstract removeFile(file: AssetFile): Promise<void>
  abstract readFile(file: AssetFile): Promise<Buffer>
  abstract listKeys(): Promise<string[]>
}

// A random UUID and the lower-cased extension of the name.
export function getUniqueKey(name: string) {
  return `${crypto.randomUUID()}${path.extname(name).toLowerCase()}`
}

export function resolveFileUrl(url: string) {
  return url.startsWith('file://')
    ? `file://${path.resolve(url.slice(7))}`
    : url
}

// The part of a url that `allowedImports` match: its origin and path, without
// the query and the hash that a `*` could match, and with all dot segments
// resolved, also encoded ones. Returns null for invalid urls and for urls with
// credentials.
function getImportSource(value: string) {
  try {
    const url = new URL(resolveFileUrl(value))
    if (url.username || url.password) return null
    return url.protocol === 'file:'
      ? `file://${fileURLToPath(url)}`
      : `${url.origin}${url.pathname}`
  } catch {
    return null
  }
}

function readDimensions(data: Buffer) {
  try {
    const { width, height } = readMediaAttributes(data)
    // Media without readable dimensions are stored without them.
    if (width > 0 || height > 0) return { width, height }
  } catch {}
  return null
}

async function detectType(data: Buffer) {
  try {
    // leather detects more media types than file-type.
    return (
      (await fileTypeFromBuffer(data))?.mime ||
      readMediaAttributes(data).mime
    )
  } catch {
    return undefined
  }
}
