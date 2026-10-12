import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useDomEvents } from './useDomEvents.ts'

function mountDomEvents() {
  return mount({ setup: () => useDomEvents(), render: () => null })
}

describe('useDomEvents()', () => {
  it('removes the handlers through `remove()`', () => {
    const { vm } = mountDomEvents()
    const element = document.createElement('div')
    const click = vi.fn()
    const handlers = vm.domOn(element, 'click', click)
    element.click()
    handlers.remove()
    element.click()
    expect(click).toHaveBeenCalledOnce()
  })

  it('removes the remaining handlers when unmounted', () => {
    const wrapper = mountDomEvents()
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
    const wrapper = mountDomEvents()
    const element = document.createElement('div')
    const click = vi.fn()
    wrapper.unmount()
    wrapper.vm.domOn(element, 'click', click)
    element.click()
    expect(click).not.toHaveBeenCalled()
  })
})
