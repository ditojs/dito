import autoprefixer from 'autoprefixer'
import postcssInset from 'postcss-inset'

export function getPostCssConfig({ removeCharset = true }) {
  return {
    plugins: [
      autoprefixer(),
      postcssInset(),
      removeCharset && {
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
