import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DomMixin from './DomMixin.js'

function mountDom() {
  return mount({ mixins: [DomMixin], render: () => null })
}

function countAbortListeners(signal) {
  let count = 0
  const { addEventListener, removeEventListener } = signal
  signal.addEventListener = (...args) => {
    count++
    addEventListener.call(signal, ...args)
  }
  signal.removeEventListener = (...args) => {
    count--
    removeEventListener.call(signal, ...args)
  }
  return () => count
}

describe('DomMixin', () => {
  it('removes the handlers through `remove()`', () => {
    const { vm } = mountDom()
    const element = document.createElement('div')
    const click = vi.fn()
    const handlers = vm.domOn(element, 'click', click)
    element.click()
    handlers.remove()
    element.click()
    expect(click).toHaveBeenCalledOnce()
  })

  it('removes the remaining handlers when unmounted', () => {
    const wrapper = mountDom()
    const element = document.createElement('div')
    const click = vi.fn()
    const focus = vi.fn()
    wrapper.vm.domOn(element, { click, focus })
    wrapper.unmount()
    element.click()
    element.dispatchEvent(new Event('focus'))
    expect(click).not.toHaveBeenCalled()
    expect(focus).not.toHaveBeenCalled()
  })

  it('does not add handlers after it was unmounted', () => {
    const wrapper = mountDom()
    const element = document.createElement('div')
    const click = vi.fn()
    wrapper.unmount()
    wrapper.vm.domOn(element, 'click', click)
    element.click()
    expect(click).not.toHaveBeenCalled()
  })

  it('keeps nothing of removed handlers', () => {
    const { vm } = mountDom()
    const getListenerCount = countAbortListeners(
      vm.domAbortController.signal
    )
    const element = document.createElement('div')
    for (let i = 0; i < 3; i++) {
      vm.domOn(element, 'click', () => {}).remove()
    }
    expect(getListenerCount()).toBe(0)
    expect(vm.$data).toEqual({})
  })
})
