import { isString } from '@ditojs/utils'
import { isStream } from 'is-stream'

export function isSupportedKoaBody(body) {
  return (
    Buffer.isBuffer(body) ||
    isString(body) ||
    body instanceof Blob ||
    body instanceof Response ||
    isStream(body)
  )
}
