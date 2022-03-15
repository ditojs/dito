import path from 'path'
import { defineConfig } from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import autoprefixer from 'autoprefixer'
import postcssInset from 'postcss-inset'
import { getRollupExternalsFromDependencies } from './rollup.js'

export function getViteConfig({
  name,
  css = false,
  minify = true,
  sourcemap = true,
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
    resolve: {
      extensions: ['.js', '.json', '.vue'],
      alias: [
        {
          find: '@',
          replacement: path.resolve('./src')
        }
      ]
    },
    css: css
      ? {
        preprocessorOptions: {
          sass: {
            additionalData: `@import './src/styles/_imports.sass'\n`
          }
        },
        postcss: {
          plugins: [
            autoprefixer(),
            postcssInset(),
            {
              // https://github.com/vitejs/vite/issues/5833
              postcssPlugin: 'internal:remove-charset',
              AtRule: {
                charset: rule => {
                  if (rule.name === 'charset') {
                    rule.remove()
                  }
                }
              }
            }
          ]
        }
      }
      : null
  })
}
