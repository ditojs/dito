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
    let heights
    let computedHeight
    let isEntering

    beforeEach(() => {
      // Record the heights that the hooks set, in order:
      heights = []
      isEntering = true
      element = {
        classList: {
          contains: name => name === 'dito-height-enter-active' && isEntering
        },
        style: {
          get height() {
            return heights.at(-1)
          },
          set height(height) {
            heights.push(height)
          }
        }
      }
      computedHeight = '120px'
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        height: computedHeight
      }))
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    const nextFrames = () =>
      new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )

    it('grows entering elements to their height once laid out', async () => {
      const { onEnter } = getTransitionProps()
      onEnter(element)
      expect(heights).toEqual([])
      // Their content may still change its layout, e.g. its vertical labels:
      computedHeight = '116px'
      await nextFrames()
      expect(heights).toEqual(['auto', 0, '116px'])
    })

    it(`doesn't grow elements that stopped entering before`, async () => {
      const { onEnter } = getTransitionProps()
      onEnter(element)
      isEntering = false
      await nextFrames()
      expect(heights).toEqual([])
    })

    it('releases the height once entered', () => {
      const { onAfterEnter } = getTransitionProps()
      element.style.height = '120px'
      onAfterEnter(element)
      expect(element.style.height).toBe(null)
    })

    it('shrinks the height of leaving elements to zero', () => {
      const { onLeave } = getTransitionProps()
      computedHeight = '80px'
      onLeave(element)
      expect(heights).toEqual(['80px', 0])
    })
  })
})
