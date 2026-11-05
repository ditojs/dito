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
  // and height of images and videos. The type and the dimensions are read from
  // the head of the data, and the rest streams through to `addFile()`.
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
    if (!this.url) return undefined
    const file = path.posix.join(...parts)
    // A base url without origin, such as `/assets/`, gives paths.
    return URL.canParse(this.url)
      ? new URL(file, this.url).toString()
      : path.posix.join(this.url, file)
  }

  // Writes the data of the file under its key.
  abstract addFile(file: AssetFile, data: FileData): Promise<void>
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

// NOTE: Videos with their index at the end, which isn't optimized for the web,
// need more than the head, and are stored without dimensions when larger.
const headLength = 8 * 1024 * 1024

async function* getChunks(data: FileData) {
  yield* Buffer.isBuffer(data) ? [data] : data
}

// Reads the first chunks of the data, at least `headLength` bytes of it, or
// all of it when shorter.
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
