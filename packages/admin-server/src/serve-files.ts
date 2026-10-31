import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

// Serves the built admin in `dist` under `base`. Files with Vite's content
// hash in their names never change, the others are checked again on each
// load. Paths without an extension are routes of the admin and get
// `index.html`. Everything else is a 404.

export function serveFiles(base: string, dist: string) {
  return async (request: Request, pathname: string): Promise<Response> => {
    const name = decodePath(pathname.slice(base.length) || '/')
    if (name === null) return notFound()
    const file = path.join(dist, name)
    if (!file.startsWith(`${dist}${path.sep}`)) return notFound()
    const stats = await getFileStats(file)
    if (stats) return sendFile(request, file, stats.size, hashedName.test(name))
    if (path.extname(name)) return notFound()
    const index = path.join(dist, 'index.html')
    const indexStats = await getFileStats(index)
    return indexStats
      ? sendFile(request, index, indexStats.size, false)
      : notFound()
  }
}

export function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}

const hashedName = /-[\w-]{8}\.\w+$/

function decodePath(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

async function getFileStats(file: string) {
  const stats = await fs.promises.stat(file).catch(() => null)
  return stats?.isFile() ? stats : null
}

function sendFile(
  request: Request,
  file: string,
  size: number,
  isHashed: boolean
) {
  const headers = {
    'Content-Type': getContentType(file),
    'Content-Length': String(size),
    'Cache-Control': isHashed
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'
  }
  const body =
    request.method === 'HEAD'
      ? null
      : (Readable.toWeb(fs.createReadStream(file)) as ReadableStream)
  return new Response(body, { headers })
}

// The types of the files that Vite builds for the admin.
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm'
}

function getContentType(file: string) {
  return (
    contentTypes[path.extname(file).toLowerCase()] ??
    'application/octet-stream'
  )
}
