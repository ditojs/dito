import { asArray, isArray, isObject, isString } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { walkData, type FieldEntry } from './schema/walk.js'
import { fetchBlob } from './request.js'
import { getResourceUrl } from './services.ts'
import { getUploadLimits, isAcceptedFile, type UploadLimits } from './upload.ts'
import type { Services } from './services.ts'
import type { Data, Schema } from './types.ts'

// The upload fields in clipboard data, as `walkData()` finds them:
export type UploadEntry = Pick<
  FieldEntry,
  'schema' | 'data' | 'name' | 'dataPath'
>

export function getUploadEntries(
  schema: Schema,
  data: Data,
  {
    dataPath,
    services,
    rootData
  }: { dataPath: string; services: Services; rootData: Data | null }
): UploadEntry[] {
  const entries: UploadEntry[] = []
  walkData(schema, data, {
    dataPath,
    services,
    rootData,
    visit: entry => {
      for (const { schema } of entry.node.fields) {
        if (schema.type === 'upload') {
          entries.push({ ...entry, schema })
        }
      }
    }
  })
  return entries
}

// Write the clipboard data as `data.json`, with its files under `files/` by
// their names, referenced instead of their URLs and signatures:
export async function createInterchangeZip(
  services: Services,
  clipboardData: Data,
  entries: UploadEntry[]
): Promise<Uint8Array> {
  const { api } = services.adminContext
  // Load `fflate` only when it's used, outside of the admin's main chunk:
  const { strToU8, zipSync } = await import('fflate')
  const filesByPath = new Map<string, Promise<Uint8Array>>()
  const pathsByKey = new Map<string, string>()
  const takenPaths = new Set<string>()
  const readFile = async (url: string) => {
    const blob = await fetchBlob(api, url)
    return new Uint8Array(await blob.arrayBuffer())
  }
  await replaceFiles(entries, file => {
    const { key, name, type, size, width, height, url } = file
    if (!url) {
      throw new Error(`Unable to download file without url: '${name}'.`)
    }
    let path = pathsByKey.get(key)
    if (!path) {
      path = getFilePath(name, takenPaths)
      pathsByKey.set(key, path)
      filesByPath.set(path, readFile(url))
    }
    return { key, name, type, size, width, height, $file: path }
  })
  const files = await Promise.all(
    [...filesByPath].map(async ([path, bytes]) => [path, await bytes])
  )
  return zipSync({
    'data.json': strToU8(JSON.stringify(clipboardData, null, 2)),
    ...Object.fromEntries(files)
  })
}

export async function readInterchangeData(zip: Uint8Array): Promise<Data> {
  const { strFromU8, unzipSync } = await import('fflate')
  const json = unzipSync(zip, {
    filter: ({ name }) => name === 'data.json'
  })['data.json']
  if (!json) {
    throw new Error(`Unable to find 'data.json' in the zip file.`)
  }
  return JSON.parse(strFromU8(json))
}

// Upload the referenced files like their fields do, for the server to store
// them under new keys, and leave out the ones that the fields don't accept.
// Only the referenced entries are inflated, and only when their size fits:
export async function uploadInterchangeFiles(
  services: Services,
  zip: Uint8Array,
  entries: UploadEntry[]
): Promise<string[]> {
  const { api } = services.adminContext
  const limitsByEntry = new Map<UploadEntry, UploadLimits>(
    entries.map(entry => [
      entry,
      getUploadLimits(
        entry.schema,
        SchemaContext.createForSchema(services, {
          itemDataPath: null,
          rootData: null,
          ...entry
        })
      )
    ])
  )
  const isAccepted = (file: Data, entry: UploadEntry, size: number) =>
    isAcceptedFile({ name: file.name, size }, limitsByEntry.get(entry)!)
  const references = entries.flatMap(entry =>
    getFiles(entry)
      .filter(isFileReference)
      .map(file => ({ file, entry }))
  )
  const { unzipSync } = await import('fflate')
  const zipFiles = unzipSync(zip, {
    filter: ({ name, originalSize }) =>
      references.some(
        ({ file, entry }) => (
          file.$file === name && isAccepted(file, entry, originalSize)
        )
      )
  })

  const uploadFile = async (
    { dataPath }: UploadEntry,
    { name, type }: Data,
    bytes: Uint8Array
  ) => {
    const url = getResourceUrl(services, {
      type: 'upload',
      method: 'post',
      path: api.normalizePath(dataPath!)
    })
    if (!url) {
      throw new Error('Unable to upload files without resource.')
    }
    // The server only accepts files named after the data path of their field:
    const formData = new FormData()
    formData.append(
      dataPath!,
      new File([bytes as Uint8Array<ArrayBuffer>], name, { type })
    )
    const response = await api.request<Data[]>({
      method: 'post',
      url,
      data: formData,
      timeout: null
    })
    return response.data[0]
  }

  const uploads = new Map<string, Promise<Data>>()
  const rejectedNames: string[] = []
  await replaceFiles(entries, (file, entry) => {
    if (!isFileReference(file)) {
      return file
    }
    const path = file.$file
    const bytes = Object.hasOwn(zipFiles, path) ? zipFiles[path] : null
    if (bytes && isAccepted(file, entry, bytes.length)) {
      if (!uploads.has(path)) {
        uploads.set(path, uploadFile(entry, file, bytes))
      }
      return uploads.get(path)
    }
    rejectedNames.push(file.name)
    return null
  })
  return rejectedNames
}

// Replace the files of all entries, leaving out the ones replaced with `null`:
async function replaceFiles(
  entries: UploadEntry[],
  replace: (file: Data, entry: UploadEntry) => any
) {
  await Promise.all(
    entries.map(async entry => {
      const { data, name } = entry
      const value = data[name]
      if (value) {
        const files = await Promise.all(
          getFiles(entry).map(file => replace(file, entry))
        )
        const replaced = files.filter(Boolean)
        data[name] = isArray(value) ? replaced : (replaced[0] ?? null)
      }
    })
  )
}

function getFiles({ data, name }: UploadEntry): Data[] {
  const value = data[name]
  return value ? asArray(value) : []
}

// Name the files after their names in the zip, numbered when different files
// share a name, and without characters that reach outside of `files/` or that
// file systems reject:
function getFilePath(name: string, takenPaths: Set<string>) {
  const fileName = name
    .replace(/[/\\:*?"<>|\p{Cc}\p{Cf}]/gu, '-')
    .replace(/^\.*$/, '-')
  const [, base, extension = ''] = fileName.match(/^(.+?)(\.[^.]*)?$/)!
  // Compare the paths like file systems that ignore case and normalization do,
  // e.g. the ones of macOS and Windows:
  const normalize = (path: string) => path.normalize('NFC').toLowerCase()
  let path = `files/${fileName}`
  for (let count = 2; takenPaths.has(normalize(path)); count++) {
    path = `files/${base} (${count})${extension}`
  }
  takenPaths.add(normalize(path))
  return path
}

function isFileReference(file: Data) {
  return isObject(file) && isString(file.$file)
}
