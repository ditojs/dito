import { getTarget } from './trigger.js'

describe('getTarget()', () => {
  const element = document.createElement('button')

  it('returns target elements and the elements of target components', () => {
    expect(getTarget({ target: element })).toBe(element)
    expect(getTarget({ target: { $el: element } })).toBe(element)
  })

  it('looks up string targets in the refs', () => {
    expect(
      getTarget({ target: 'button', $refs: { button: element } })
    ).toBe(element)
    expect(
      getTarget({ target: 'button', $refs: { button: { $el: element } } })
    ).toBe(element)
  })

  it('returns `undefined` without target', () => {
    expect(getTarget({ target: null })).toBe(null)
    expect(getTarget({ target: 'button', $refs: {} })).toBe(undefined)
  })
})
