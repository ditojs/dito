import { getViteConfig } from '@ditojs/build'

export default getViteConfig({
  name: 'dito-server',
  sourcemap: 'inline',
  minify: false,
  css: false
})
