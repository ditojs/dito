import { vi } from 'vitest'
import { addEvents } from './event.js'

describe('addEvents()', () => {
  it('adds and removes the event handlers on all targets', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    const click = vi.fn()
    const focus = vi.fn()
    const events = addEvents([first, second], { click, focus })
    first.dispatchEvent(new Event('click'))
    second.dispatchEvent(new Event('focus'))
    expect(click).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledOnce()
    events.remove()
    first.dispatchEvent(new Event('click'))
    second.dispatchEvent(new Event('focus'))
    expect(click).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledOnce()
  })

  it('supports single targets and node lists', () => {
    const parent = document.createElement('div')
    parent.innerHTML = '<span></span><span></span>'
    const click = vi.fn()
    addEvents(parent.querySelectorAll('span'), { click })
    addEvents(parent, { click })
    parent.lastChild.dispatchEvent(new Event('click'))
    parent.dispatchEvent(new Event('click'))
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('removes the event handlers when the signal aborts', () => {
    const target = document.createElement('div')
    const click = vi.fn()
    const controller = new AbortController()
    addEvents(target, { click }, { signal: controller.signal })
    target.click()
    controller.abort()
    target.click()
    expect(click).toHaveBeenCalledOnce()
  })

  it(`doesn't add event handlers when the signal already aborted`, () => {
    const target = document.createElement('div')
    const click = vi.fn()
    addEvents(target, { click }, { signal: AbortSignal.abort() })
    target.click()
    expect(click).not.toHaveBeenCalled()
  })
})
