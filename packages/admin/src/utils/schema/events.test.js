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

  it('supports the deprecated `events`, replacing the same handlers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const click = () => {}
    const onClick = () => {}
    const onFocus = () => {}
    const schema = { events: { click }, onClick, onFocus }
    expect(getSchemaEventEntries(schema)).toEqual([
      { key: 'click', event: 'click', callback: click },
      { key: 'onFocus', event: 'focus', callback: onFocus }
    ])
    getSchemaEventEntries(schema)
    // The deprecation is logged once:
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toMatch(/`events` are deprecated/)
    warn.mockRestore()
  })
})
