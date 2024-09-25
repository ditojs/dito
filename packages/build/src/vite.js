import { defineConfig as viteDefineConfig } from 'vite'
import createVuePlugin from '@vitejs/plugin-vue'
import { getPostCssConfig } from './postcss.js'
import { getRollupExternalsFromDependencies } from './rollup.js'

export function defineViteConfig({
  defineConfig = viteDefineConfig,
  name,
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
  const externals = (
    build &&
    getRollupExternalsFromDependencies({
      include,
      exclude
    })
  )
  return defineConfig({
    plugins: vue
      ? [createVuePlugin()]
      : null,
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
          postcss: getPostCssConfig(),
          preprocessorOptions: {
            scss: {
              // https://sass-lang.com/documentation/breaking-changes/legacy-js-api/
              // TODO: Remove once vite has been updated to new API:
              silenceDeprecations: ['legacy-js-api']
            }
          }
        }
      : null,
    ...rest
  })
}
