import { getRejectedFileNames } from '../utils/upload.ts'

export const extensions = {
  validate: (value, extensions) => !getRejectedFileNames(value, { extensions }),
  message: (value, extensions) =>
    `must not contain files of unsupported types: ${
      getRejectedFileNames(value, { extensions })
    }`
}
