import type { FromModel } from '@ditojs/server'
import type * as models from './index.js'

declare module './Author.js' {
  interface Author extends FromModel<typeof Author, typeof models> {}
}

declare module './Book.js' {
  interface Book extends FromModel<typeof Book, typeof models> {}
}
