import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import picomatch from 'picomatch'
import { fileTypeFromBuffer } from 'file-type'
import { readMediaAttributes } from 'leather'
import { isString } from '@ditojs/utils'

// A stored file as it appears in JSON data:
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

// The data of a file, whole or as a stream of chunks, such as a Node
// `Readable` or a web `ReadableStream`.
export type FileData = Buffer | AsyncIterable<Uint8Array>

export interface StoreOptions {
  name: string
  // Detected from the data when missing.
  type?: string
  data: FileData
}

export abstract class Storage {
  name: string
  url: string | undefined
  #isAllowedImport: (url: string) => boolean

  constructor({ name, url, allowedImports = [] }: StorageOptions) {
    this.name = name
    // `new URL()` drops the last segment of a base without a trailing slash.
    this.url = url && !url.endsWith('/') ? `${url}/` : url
    this.#isAllowedImport = picomatch(allowedImports.map(resolveFileUrl))
  }

  isImportSourceAllowed(url: unknown) {
    // Files without a `url` have no source to import from.
    const source = isString(url) ? getImportSource(url) : null
    return source !== null && this.#isAllowedImport(source)
  }

  // Read the type and the dimensions from the head of the data, and stream the
  // rest through to `addFile()`:
  async store({ name, type, data }: StoreOptions): Promise<AssetFile> {
    const chunks = getChunks(data)
    const head = await readHead(chunks)
    // Multipart bodies give untyped files `application/octet-stream`, so
    // detect the type of those as well.
    type = (
      (type !== 'application/octet-stream' && type) ||
      (await detectType(head)) ||
      'application/octet-stream'
    )
    let size = head.byteLength
    const file: AssetFile = {
      key: getUniqueKey(name),
      name,
      type,
      size,
      ...(/^(image|video)\//.test(type) ? readDimensions(head) : null)
    }
    await this.addFile(
      file,
      (async function* () {
        yield head
        for await (const chunk of chunks) {
          size += chunk.byteLength
          yield chunk
        }
      })()
    )
    file.size = size
    const url = this.getFileUrl(file)
    if (url) file.url = url
    return file
  }

  getFileUrl(_file: AssetFile): string | undefined {
    return undefined
  }

  protected getUrl(...parts: string[]) {
    const { url } = this
    const file = path.posix.join(...parts)
    // A base url without origin, such as `/assets/`, gives paths.
    return url
      ? URL.canParse(url)
        ? new URL(file, url).toString()
        : path.posix.join(url, file)
      : undefined
  }

  abstract addFile(file: AssetFile, data: FileData): Promise<void>
  abstract removeFile(file: AssetFile): Promise<void>
  abstract readFile(file: AssetFile): Promise<Buffer>
  abstract listKeys(): Promise<string[]>
}

// `win32` also cuts at backslashes, so that keys never hold separators:
export function getUniqueKey(name: string) {
  return `${crypto.randomUUID()}${path.win32.extname(name).toLowerCase()}`
}

// Only keys of the form of `getUniqueKey()` address no other file.
export function isValidKey(key: string) {
  return /^[\w-]+(\.[^./\\]*)?$/.test(key)
}

export function resolveFileUrl(url: string) {
  return url.startsWith('file://')
    ? `file://${path.resolve(url.slice(7))}`
    : url
}

// Match `allowedImports` against the origin and path of a url, without the
// query and the hash that a `*` could match, and with all dot segments
// resolved, also encoded ones. Invalid urls and urls with credentials give
// null.
function getImportSource(value: string) {
  try {
    const url = new URL(resolveFileUrl(value))
    return url.username || url.password
      ? null
      : url.protocol === 'file:'
        ? `file://${fileURLToPath(url)}`
        : `${url.origin}${url.pathname}`
  } catch {
    return null
  }
}

// NOTE: Videos with their index at the end, which isn't optimized for the web,
// need more than the head, and are stored without dimensions when larger.
const headLength = 8 * 1024 * 1024

export async function* getChunks(data: FileData) {
  yield* Buffer.isBuffer(data) ? [data] : data
}

// Read at least `headLength` bytes, or all of the data when shorter:
async function readHead(chunks: AsyncGenerator<Uint8Array>) {
  const head: Uint8Array[] = []
  let length = 0
  while (length < headLength) {
    const { value, done } = await chunks.next()
    if (done) break
    head.push(value)
    length += value.byteLength
  }
  return Buffer.concat(head)
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
