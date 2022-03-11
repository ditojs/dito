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
      css ? injectCssIntoJsPlugin({ name }) : null,
      // Node.js hybrid packages without type: "module" need `mjs` to work
      // form other node hybrid packages.
      renameJsExtensionPlugin({ from: '.es.js', to: '.es.mjs' })
    ],
    esbuild: { minify },
    build: {
      minify,
      sourcemap,
      // This will result in the css being a separate file in es builds and
      // inlined in umd builds, which is almost what we want for the library.
      // For the es build, `injectCssIntoJsPlugin()` is then subsequently used
      // to inject the css file into the js.
      cssCodeSplit: css,
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

function isJsChunk(chunk) {
  return (
    chunk.type === 'chunk' &&
    chunk.fileName.endsWith('.js') &&
    !chunk.fileName.includes('polyfill')
  )
}

function isCssAsset(chunk) {
  return (
    chunk.type === 'asset' &&
    chunk.fileName.endsWith('.css')
  )
}

export function renameJsExtensionPlugin({ from, to }) {
  return {
    name: 'rename-file-plugin',
    apply: 'build',
    enforce: 'post',

    generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        const name = chunk.fileName
        if (isJsChunk(chunk) && name.endsWith(from)) {
          chunk.fileName = name.substring(0, name.length - from.length) + to
        }
      }
    }
  }
}

// https://stackoverflow.com/questions/67781170/bundle-js-and-css-into-single-file-with-vite
// https://github.com/vitejs/vite/issues/1579
export function injectCssIntoJsPlugin({ name, prioritize = true } = {}) {
  return {
    name: 'inject-css-into-js-plugin',
    apply: 'build',
    enforce: 'post',

    generateBundle(options, bundle) {
      let css = ''
      for (const [key, chunk] of Object.entries(bundle)) {
        if (isCssAsset(chunk)) {
          css += chunk.source
          if (name && /^(?:index|style).css$/.test(chunk.fileName)) {
            chunk.fileName = `${name}.css`
          } else {
            delete bundle[key]
          }
        }
      }

      if (css) {
        for (const chunk of Object.values(bundle)) {
          if (isJsChunk(chunk)) {
            const prefix = prioritize ? '' : chunk.code
            const suffix = prioritize ? chunk.code : ''
            const style = `__vite_style__`
            const code =
            `var ${style} = document.createElement('style');` +
            `${style}.innerHTML = ${JSON.stringify(css.trim())};` +
            `document.head.appendChild(${style});`
            chunk.code = `${prefix}(function(){ ${code} })();${suffix}`
            break
          }
        }
      }
    },

    transformIndexHtml: {
      enforce: 'post',
      transform(html, ctx) {
        if (ctx?.bundle) {
          for (const chunk of Object.values(ctx.bundle)) {
            if (isCssAsset(chunk)) {
              // Remove CSS link from the generated HTML.
              const exp = new RegExp(
                `<link rel="stylesheet"[^>]*?href="/${chunk.fileName}"[^>]*?>`
              )
              html = html.replace(exp, '')
            }
          }
        }
        return html
      }
    }
  }
}
