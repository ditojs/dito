import { mount } from '@vue/test-utils'
import DitoResizeHandle from './DitoResizeHandle.vue'

function mountResizeHandle() {
  const element = document.createElement('div')
  // happy-dom doesn't lay out, so the element gets a height to start from:
  element.style.height = '100px'
  element.style.fontSize = '10px'
  document.body.appendChild(element)
  const wrapper = mount(DitoResizeHandle, {
    props: { getElement: () => element },
    attachTo: document.body
  })
  return { wrapper, element }
}

describe('DitoResizeHandle', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is a focusable separator', () => {
    const { wrapper } = mountResizeHandle()
    expect(wrapper.classes()).toContain('dito-resize')
    expect(wrapper.attributes()).toMatchObject({
      'tabindex': '0',
      'role': 'separator',
      'aria-orientation': 'horizontal',
      'aria-label': 'Resize'
    })
  })

  it('emits the height of the element changed by the arrow keys', async () => {
    const { wrapper } = mountResizeHandle()
    await wrapper.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    expect(wrapper.emitted('resize')).toEqual([[110], [0]])
  })

  it('measures the element at the start of each resize', async () => {
    const { wrapper, element } = mountResizeHandle()
    await wrapper.trigger('keydown', { key: 'ArrowDown' })
    element.style.height = '50px'
    await wrapper.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('resize')).toEqual([[110], [40]])
  })
})
