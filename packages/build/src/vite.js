import { defineConfig as viteDefineConfig } from 'vite'
import createVuePlugin from '@vitejs/plugin-vue'
import { getPostCssConfig } from './postcss.js'
import {
  getRollupExternalsFromDependencies,
  isRollupExternal
} from './rollup.js'

export function defineViteConfig({
  defineConfig = viteDefineConfig,
  name,
  css = false,
  vue = false,
  build = true,
  minify = !process.argv.includes('--watch'),
  // Inline source maps for watch builds, e.g. when linked into an app during
  // development, but none in published builds, to keep the packages small.
  sourcemap = minify ? false : 'inline',
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
            fileName: format => `${name}.${format}.js`,
            cssFileName: name
          },
          rollupOptions: {
            external: id => isRollupExternal(id, externals),
            output: {
              // Entries with both named and default exports, e.g. admin's
              // `DitoAdmin`, expose them all on the UMD object, with the
              // default export as `.default`:
              exports: 'named',
              manualChunks: undefined,
              // Use the module identifiers as UMD globals, including subpaths:
              globals: id => id
            }
          }
        }
      : null,
    css: css
      ? {
          postcss: getPostCssConfig(),
          preprocessorOptions: {
            scss: {
              // TODO: Convert all @import statements to @use:
              // https://sass-lang.com/documentation/breaking-changes/import/
              silenceDeprecations: ['import']
            }
          }
        }
      : null,
    ...rest
  })
}
