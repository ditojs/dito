import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import TransitionHeight from './TransitionHeight.vue'

// Returns the hooks that `TransitionHeight` passes to `Transition`.
function getTransitionProps() {
  // `TransitionHeight` is a functional component, so it can be called:
  const render = TransitionHeight
  const vnode = render(
    { enabled: true },
    { slots: { default: () => [] } }
  )
  // @vue/test-utils replaces `Transition` with a stub of the same name.
  expect(vnode.type.name).toMatch(/^transition$/i)
  return vnode.props
}

describe('TransitionHeight', () => {
  it('renders its content without transition when disabled', () => {
    const wrapper = mount(TransitionHeight, {
      props: { enabled: false },
      slots: { default: () => h('div', { class: 'chapter' }, 'Chapter') }
    })
    expect(wrapper.find('.chapter').text()).toBe('Chapter')
  })

  it('renders its content in a `dito-height` transition by default', () => {
    const wrapper = mount(TransitionHeight, {
      slots: { default: () => h('div', { class: 'chapter' }, 'Chapter') }
    })
    expect(wrapper.find('.chapter').exists()).toBe(true)
    expect(getTransitionProps().name).toBe('dito-height')
  })

  describe('hooks', () => {
    let element
    let computedHeight

    beforeEach(() => {
      vi.useFakeTimers()
      // happy-dom doesn't clear styles that are set to null like browsers do,
      // so record the styles on a plain object instead.
      element = { style: {} }
      computedHeight = '120px'
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        width: '300px',
        height: computedHeight
      }))
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('measures and grows the height of entering elements', () => {
      const { onEnter } = getTransitionProps()
      onEnter(element)
      // Measured at full width, invisibly:
      expect(element.style.width).toBe('300px')
      expect(element.style.position).toBe('absolute')
      expect(element.style.visibility).toBe('hidden')
      expect(element.style.height).toBe('auto')
      vi.advanceTimersToNextTimer()
      expect(element.style).toEqual({
        width: null,
        position: null,
        visibility: null,
        height: 0
      })
      vi.advanceTimersToNextTimer()
      expect(element.style.height).toBe('120px')
    })

    it('releases the height once entered', () => {
      const { onAfterEnter } = getTransitionProps()
      element.style.height = '120px'
      onAfterEnter(element)
      expect(element.style.height).toBe('120px')
      vi.runAllTimers()
      expect(element.style.height).toBe(null)
    })

    it('shrinks the height of leaving elements to zero', () => {
      const { onLeave } = getTransitionProps()
      computedHeight = '80px'
      onLeave(element)
      expect(element.style.height).toBe('80px')
      vi.runAllTimers()
      expect(element.style.height).toBe(0)
    })
  })
})
