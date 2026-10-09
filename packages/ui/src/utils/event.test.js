import { vi } from 'vitest'
import {
  addEvents,
  combineEvents,
  getKey,
  getKeyNavigation
} from './event.js'

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
})

describe('combineEvents()', () => {
  it('removes all combined events', () => {
    const events = [{ remove: vi.fn() }, { remove: vi.fn() }]
    combineEvents(...events).remove()
    for (const event of events) {
      expect(event.remove).toHaveBeenCalledOnce()
    }
  })
})

describe('getKey()', () => {
  it('names the arrow and enter keys', () => {
    expect(getKey({ keyCode: 37 })).toBe('left')
    expect(getKey({ keyCode: 40 })).toBe('down')
    expect(getKey({ keyCode: 13 })).toBe('enter')
    expect(getKey({ keyCode: 65 })).toBe(undefined)
    expect(getKey(null)).toBe(undefined)
  })
})

describe('getKeyNavigation()', () => {
  it('returns the horizontal and vertical direction and enter', () => {
    expect(getKeyNavigation({ keyCode: 37 })).toEqual({
      hor: -1,
      ver: 0,
      enter: false
    })
    expect(getKeyNavigation({ keyCode: 40 })).toEqual({
      hor: 0,
      ver: 1,
      enter: false
    })
    expect(getKeyNavigation({ keyCode: 13 })).toEqual({
      hor: 0,
      ver: 0,
      enter: true
    })
  })
})
