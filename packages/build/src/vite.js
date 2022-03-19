import { defineConfig } from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import { getPostCssConfig } from './postcss.js'
import { getRollupExternalsFromDependencies } from './rollup.js'

export function getViteConfig({
  name,
  css = false,
  minify = !process.argv.includes('--watch'),
  sourcemap = 'inline',
  externals: {
    include = [],
    exclude = []
  } = {}
} = {}) {
  const externals = getRollupExternalsFromDependencies({ include, exclude })
  return defineConfig({
    plugins: [
      createVuePlugin()
    ],
    esbuild: { minify },
    build: {
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
    },
    css: css
      ? {
        preprocessorOptions: {
          sass: {
            additionalData: `@import './src/styles/_imports.sass'\n`
          }
        },
        postcss: getPostCssConfig({ removeCharset: true })
      }
      : null
  })
}
