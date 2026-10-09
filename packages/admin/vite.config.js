import { defineViteConfig } from '@ditojs/build'

export default defineViteConfig({
  name: 'dito-admin',
  vue: true,
  css: true,
  rollupOutput: {
    // The entry has both named and default exports, e.g. `DitoAdmin`: Expose
    // them all on the UMD object, with the default export as `.default`:
    exports: 'named'
  }
})
