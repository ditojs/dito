import { mount } from '@vue/test-utils'
import PulldownMixin from './PulldownMixin.js'

function mountPulldown() {
  return mount(
    {
      mixins: [PulldownMixin],
      render: () => null
    },
    { attachTo: document.body }
  )
}

function triggerDocumentEvent(type) {
  document.dispatchEvent(new MouseEvent(type, { bubbles: true }))
}

describe('PulldownMixin', () => {
  it('closes the pulldown on mousedown outside of it', () => {
    const { vm } = mountPulldown()
    vm.onPulldownMouseDown()
    expect(vm.pulldown.open).toBe(true)
    triggerDocumentEvent('mousedown')
    expect(vm.pulldown.open).toBe(false)
  })

  it('removes the document handlers once the pulldown closes', () => {
    const { vm } = mountPulldown()
    for (let i = 0; i < 3; i++) {
      vm.onPulldownMouseDown()
      expect(vm.domHandlers).toHaveLength(1)
      triggerDocumentEvent('mousedown')
      expect(vm.domHandlers).toHaveLength(0)
    }
  })

  it('keeps the pulldown open on a quick mouseup after opening it', () => {
    const { vm } = mountPulldown()
    vm.onPulldownMouseDown()
    triggerDocumentEvent('mouseup')
    expect(vm.pulldown.open).toBe(true)
  })

  it('selects items on mouseup after mousedown on them', () => {
    const { vm } = mountPulldown()
    const selected = []
    vm.onPulldownSelect = value => selected.push(value)
    vm.onPulldownMouseDown()
    vm.onPulldownMouseDown('novel')
    expect(vm.pulldown.checkTime).toBe(false)
    expect(vm.onPulldownMouseUp('novel')).toBe(true)
    expect(vm.pulldown.open).toBe(false)
    expect(selected).toEqual(['novel'])
    expect(vm.domHandlers).toHaveLength(0)
  })

  it('removes the document handlers on unmount', () => {
    const wrapper = mountPulldown()
    const { vm } = wrapper
    vm.onPulldownMouseDown()
    wrapper.unmount()
    expect(vm.domHandlers).toHaveLength(0)
    triggerDocumentEvent('mousedown')
    expect(vm.pulldown.open).toBe(true)
  })
})
