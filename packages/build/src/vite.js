import { defineConfig as defineViteConfig } from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import { getPostCssConfig } from './postcss.js'
import {
  getRollupExternalsFromDependencies,
  createRollupImportsResolver
} from './rollup.js'

export function getViteConfig({
  name,
  defineConfig = defineViteConfig,
  css = false,
  vue = false,
  build = true,
  minify = !process.argv.includes('--watch'),
  sourcemap = 'inline',
  externals: {
    include = [],
    exclude = []
  } = {},
  ...rest
} = {}) {
  const externals = build && getRollupExternalsFromDependencies({
    include,
    exclude
  })
  return defineConfig({
    plugins: vue
      ? [
        createVuePlugin()
      ]
      : null,
    resolve: {
      alias: [
        createRollupImportsResolver()
      ]
    },
    esbuild: build
      ? { minify }
      : null,
    build: build
      ? {
        minify,
        sourcemap,
        cssCodeSplit: false,
        lib: {
          name,
          format: ['es', 'umd'],
          entry: './src/index.js',
          fileName: format => `${name}.${format}.js`
        },
        rollupOptions: {
          external: id => !!externals[id],
          output: {
            manualChunks: undefined,
            globals: externals
          }
        }
      }
      : null,
    css: css
      ? {
        preprocessorOptions: {
          sass: {
            additionalData: `@import './src/styles/_imports.sass'\n`
          }
        },
        postcss: getPostCssConfig({ removeCharset: true })
      }
      : null,
    ...rest
  })
}
