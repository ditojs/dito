import { vi } from 'vitest'
import { getSchemaEventEntries } from './events.js'

describe('getSchemaEventEntries()', () => {
  it('returns the `on[A-Z]` handlers with their events', () => {
    const onMouseenter = () => {}
    const onPointerDown = () => {}
    expect(
      getSchemaEventEntries({ onMouseenter, onPointerDown, type: 'text' })
    ).toEqual([
      { key: 'onMouseenter', event: 'mouseenter', callback: onMouseenter },
      { key: 'onPointerDown', event: 'pointer-down', callback: onPointerDown }
    ])
  })

  it('supports the deprecated `events`, behind the `on…` handlers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const click = () => {}
    const focus = () => {}
    const onClick = () => {}
    const schema = { name: 'save', events: { click, focus }, onClick }
    expect(getSchemaEventEntries(schema)).toEqual([
      { key: 'onClick', event: 'click', callback: onClick },
      { key: 'focus', event: 'focus', callback: focus }
    ])
    getSchemaEventEntries(schema)
    // The deprecation and the ignored event are logged once:
    expect(warn.mock.calls).toEqual([
      [expect.stringMatching(/`events` are deprecated/)],
      [
        "Schema 'save' ignores its deprecated `events.click()`, " +
        "as `onClick()` handles 'click'."
      ]
    ])
    warn.mockRestore()
  })
})
