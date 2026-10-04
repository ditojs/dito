import autoprefixer from 'autoprefixer'

export function getPostCssConfig() {
  return {
    plugins: [
      autoprefixer()
    ]
  }
}
