import { getPostCssConfig } from './postcss.js'

describe('getPostCssConfig()', () => {
  it('returns a config with the autoprefixer plugin', () => {
    const { plugins } = getPostCssConfig()
    expect(plugins).toHaveLength(1)
    expect(plugins[0].postcssPlugin).toBe('autoprefixer')
  })

  it('creates fresh plugin instances on each call', () => {
    expect(getPostCssConfig().plugins[0]).not.toBe(
      getPostCssConfig().plugins[0]
    )
  })
})
