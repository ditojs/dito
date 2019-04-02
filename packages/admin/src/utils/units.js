import filesize from 'filesize'

export function formatFileSize(size) {
  return filesize(size, { base: 10 })
}
