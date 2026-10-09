import DitoComponent from './DitoComponent.js'

describe('DitoComponent.component()', () => {
  it('returns registered components', () => {
    const registered = DitoComponent.component('BookCover', {
      props: { title: { type: String, default: null } }
    })
    expect(registered).toMatchObject({
      name: 'BookCover',
      extends: DitoComponent
    })
    expect(DitoComponent.component('BookCover')).toBe(registered)
  })

  it('throws for components that are not registered', () => {
    expect(() => DitoComponent.component('AuthorPortrait')).toThrow(
      'Component "AuthorPortrait" not registered'
    )
  })
})
