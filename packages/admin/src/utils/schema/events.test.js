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
})
