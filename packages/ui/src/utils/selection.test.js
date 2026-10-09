import { setSelection, getSelection } from './selection.js'

describe('setSelection() and getSelection()', () => {
  it('sets and gets the selection of inputs', () => {
    const input = document.createElement('input')
    document.body.append(input)
    input.value = 'Orlando'
    setSelection(input, { start: 1, end: 4 })
    expect(getSelection(input)).toEqual({ start: 1, end: 4 })
    expect(document.activeElement).toBe(input)
    input.remove()
  })

  it('ignores elements without selection', () => {
    const div = document.createElement('div')
    expect(() => setSelection(div, { start: 0, end: 1 })).not.toThrow()
    expect(() => setSelection(null, { start: 0, end: 1 })).not.toThrow()
    expect(getSelection(div)).toBe(null)
    expect(getSelection(null)).toBe(null)
  })
})
