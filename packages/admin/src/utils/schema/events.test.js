import { getSchemaEventEntries } from './events.js'

describe('getSchemaEventEntries()', () => {
  it('normalizes both forms of event definitions', () => {
    const click = () => {}
    const onMouseenter = () => {}
    const onPointerDown = () => {}
    expect(
      getSchemaEventEntries({
        events: { click },
        onMouseenter,
        onPointerDown,
        type: 'text'
      })
    ).toEqual([
      { key: 'click', event: 'click', callback: click },
      { key: 'onMouseenter', event: 'mouseenter', callback: onMouseenter },
      { key: 'onPointerDown', event: 'pointer-down', callback: onPointerDown }
    ])
  })
})
