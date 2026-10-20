import { formatFileSize } from '../utils/units.js'
import { getRejectedFileNames } from '../utils/upload.ts'

export const maxSize = {
  validate: (value, maxSize) => !getRejectedFileNames(value, { maxSize }),
  message: (value, maxSize) =>
    `must not contain files larger than ${formatFileSize(maxSize)}: ${
      getRejectedFileNames(value, { maxSize })
    }`
}
