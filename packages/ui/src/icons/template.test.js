import renderIcons from './template.js'

describe('icons template', () => {
  const icons = [
    { name: 'book', url: 'url("data:image/svg+xml,book")' },
    { name: 'shelf', url: 'url("data:image/svg+xml,shelf")' }
  ]

  it('lists the icon names in the `$icons` variable', () => {
    expect(renderIcons(icons)).toMatch(/^\$icons: book shelf;\n/)
  })

  it('renders the shared `%icon` placeholder once', () => {
    const scss = renderIcons(icons)
    expect(scss.match(/^%icon \{/gm)).toHaveLength(1)
    expect(scss).toContain('mask: none no-repeat center content-box;')
  })

  it('renders a placeholder per icon that masks with its data uri', () => {
    const scss = renderIcons(icons)
    for (const { name, url } of icons) {
      expect(scss).toContain(
        `%icon-${name} {\n  @extend %icon;\n\n  mask-image: ${url};\n}`
      )
    }
  })

  it('renders an empty list without icons', () => {
    const scss = renderIcons([])
    expect(scss).toMatch(/^\$icons: ;\n/)
    expect(scss).not.toContain('%icon-')
  })
})
