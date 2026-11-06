import type { Context } from 'hono'
import { getMimeType } from 'hono/utils/mime'

export interface SendFileOptions {
  filename?: string
  // Default: the type of the file's extension.
  type?: string
  // Shows the file in the browser, instead of downloading it.
  inline?: boolean
}

// Returns a response with a file, also from a stream such as a Node `Readable`.
export function sendFile(
  c: Context,
  body: BodyInit | AsyncIterable<Uint8Array>,
  { filename, type, inline = false }: SendFileOptions
) {
  return c.body(body as never, 200, {
    'Content-Type': (
      type ??
      (filename && getMimeType(filename)) ??
      'application/octet-stream'
    ),
    'Content-Disposition': getDisposition(inline, filename)
  })
}

function getDisposition(inline: boolean, filename?: string) {
  const type = inline ? 'inline' : 'attachment'
  if (!filename) return type
  // The plain name is for clients that don't read `filename*`.
  const plainName = filename.replace(/[^\x20-\x7e]|["\\]/g, '_')
  // `filename*` doesn't allow the characters `'()*`, which
  // `encodeURIComponent()` keeps.
  const encodedName = encodeURIComponent(filename).replace(
    /['()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `${type}; filename="${plainName}"; filename*=UTF-8''${encodedName}`
}
