import { vi } from 'vitest'
import { startDragResize, resizeByArrowKey } from './dragResize.js'

function createResizable() {
  const element = document.createElement('div')
  element.style.height = '100px'
  element.style.fontSize = '10px'
  const handle = document.createElement('div')
  element.append(handle)
  document.body.append(element)
  const onResize = vi.fn(height => {
    element.style.height = `${height}px`
  })
  // Dispatches a pointer event on the handle, which it captured, and passes
  // the `pointerdown` event to `startDragResize()`.
  const dispatch = (type, { clientY, pointerId = 1, button = 0 }) => {
    const event = new PointerEvent(type, { clientY, pointerId, button })
    if (type === 'pointerdown') {
      handle.addEventListener(
        'pointerdown',
        event => startDragResize(event, { element, onResize }),
        { once: true }
      )
    }
    handle.dispatchEvent(event)
  }
  return { element, handle, onResize, dispatch }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('startDragResize()', () => {
  it('resizes the height by the dragged distance', () => {
    const { handle, onResize, dispatch } = createResizable()
    dispatch('pointerdown', { clientY: 50 })
    expect(handle.hasPointerCapture(1)).toBe(true)
    dispatch('pointermove', { clientY: 70 })
    expect(onResize).toHaveBeenLastCalledWith(120)
    dispatch('pointermove', { clientY: 10 })
    expect(onResize).toHaveBeenLastCalledWith(60)
    dispatch('pointerup', { clientY: 0 })
    expect(onResize).toHaveBeenLastCalledWith(50)
  })

  it('stops resizing when the drag ends', () => {
    const { onResize, dispatch } = createResizable()
    dispatch('pointerdown', { clientY: 50 })
    dispatch('pointerup', { clientY: 60 })
    onResize.mockClear()
    dispatch('pointermove', { clientY: 80 })
    expect(onResize).not.toHaveBeenCalled()
  })

  it('stops resizing when the pointer is cancelled', () => {
    const { onResize, dispatch } = createResizable()
    dispatch('pointerdown', { clientY: 50 })
    dispatch('pointercancel', { clientY: 50 })
    dispatch('pointermove', { clientY: 80 })
    expect(onResize).not.toHaveBeenCalled()
  })

  it('ignores other pointers and buttons', () => {
    const { onResize, dispatch } = createResizable()
    dispatch('pointerdown', { clientY: 50, button: 2 })
    dispatch('pointermove', { clientY: 80 })
    dispatch('pointerdown', { clientY: 50 })
    dispatch('pointermove', { clientY: 80, pointerId: 2 })
    dispatch('pointerup', { clientY: 80, pointerId: 2 })
    expect(onResize).not.toHaveBeenCalled()
    dispatch('pointermove', { clientY: 60 })
    expect(onResize).toHaveBeenLastCalledWith(110)
  })

  it('does not resize below zero', () => {
    const { onResize, dispatch } = createResizable()
    dispatch('pointerdown', { clientY: 200 })
    dispatch('pointermove', { clientY: 0 })
    expect(onResize).toHaveBeenLastCalledWith(0)
  })
})

describe('resizeByArrowKey()', () => {
  it('resizes by the font size per arrow key, by ten with Shift', () => {
    const { element, onResize } = createResizable()
    const press = (key, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey,
        cancelable: true
      })
      resizeByArrowKey(event, { element, onResize })
      return event.defaultPrevented
    }
    expect(press('ArrowDown')).toBe(true)
    expect(onResize).toHaveBeenLastCalledWith(110)
    expect(press('ArrowUp', true)).toBe(true)
    expect(onResize).toHaveBeenLastCalledWith(10)
    expect(press('Enter')).toBe(false)
    expect(onResize).toHaveBeenCalledTimes(2)
  })
})
