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
      createVuePlugin(),
      // Node.js hybrid packages without type: "module" need `mjs` to work
      // form other node hybrid packages.
      renameJsExtensionPlugin({ from: '.es.js', to: '.es.mjs' })
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
              postcssPlugin: 'internal:charset-removal',
              AtRule: {
                charset: atRule => {
                  if (atRule.name === 'charset') {
                    atRule.remove()
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

export function renameJsExtensionPlugin({ from, to }) {
  return {
    name: 'rename-file-plugin',
    apply: 'build',
    enforce: 'post',

    generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        const name = chunk.fileName
        if (
          chunk.type === 'chunk' &&
          chunk.fileName.endsWith(from)
        ) {
          chunk.fileName = name.substring(0, name.length - from.length) + to
        }
      }
    }
  }
}
