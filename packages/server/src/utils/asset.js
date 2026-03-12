import path from 'path'

export function resolveFileUrl(url) {
  return url.startsWith('file://')
    ? `file://${path.resolve(url.slice(7))}`
    : url
}
