import autoprefixer from 'autoprefixer'
import postcssInset from 'postcss-inset'

export function getPostCssConfig() {
  return {
    plugins: [
      autoprefixer(),
      postcssInset()
    ]
  }
}
