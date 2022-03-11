import { getViteConfig } from '@ditojs/build'

export default getViteConfig({
  name: 'dito-build',
  sourcemap: 'inline',
  minify: false,
  css: false
})
