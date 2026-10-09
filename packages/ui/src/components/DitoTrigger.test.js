import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import DitoTrigger from './DitoTrigger.vue'

function mountTrigger(props = {}) {
  return mount(DitoTrigger, {
    props,
    slots: {
      trigger: '<button class="open">Open</button>',
      popup: '<div class="content"><input></div>'
    },
    attachTo: document.body
  })
}

async function waitForTimers() {
  await new Promise(resolve => setTimeout(resolve, 10))
  await flushPromises()
}

describe('DitoTrigger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens on click and sets `aria-expanded`', async () => {
    const wrapper = mountTrigger()
    const trigger = wrapper.find('.dito-trigger')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.content').exists()).toBe(true)
    wrapper.unmount()
  })

  it('closes with Escape without letting it propagate', async () => {
    const onKeyDown = vi.fn()
    document.body.addEventListener('keydown', onKeyDown)
    const wrapper = mountTrigger()
    await wrapper.find('.dito-trigger').trigger('click')
    await wrapper.find('.content input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
      'false'
    )
    expect(onKeyDown).not.toHaveBeenCalled()
    // Once closed, Escape propagates again:
    await wrapper.find('.open').trigger('keydown', { key: 'Escape' })
    expect(onKeyDown).toHaveBeenCalledOnce()
    document.body.removeEventListener('keydown', onKeyDown)
    wrapper.unmount()
  })

  it('only listens to the window while the popup is shown', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const getMouseUpCalls = spy =>
      spy.mock.calls.filter(([type]) => type === 'mouseup')
    const wrapper = mountTrigger()
    await nextTick()
    expect(getMouseUpCalls(addEventListener)).toHaveLength(0)
    await wrapper.find('.dito-trigger').trigger('click')
    await nextTick()
    expect(getMouseUpCalls(addEventListener)).toHaveLength(1)
    // Clicking outside closes the popup and removes the listener:
    window.dispatchEvent(new MouseEvent('mouseup'))
    await nextTick()
    await nextTick()
    expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
      'false'
    )
    expect(getMouseUpCalls(removeEventListener)).toHaveLength(1)
    wrapper.unmount()
  })

  it('closes popups that are shown initially when clicking outside', async () => {
    const wrapper = mountTrigger({ show: true })
    await nextTick()
    expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
      'true'
    )
    window.dispatchEvent(new MouseEvent('mouseup'))
    await nextTick()
    expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
      'false'
    )
    wrapper.unmount()
  })

  it(`stops waiting for the popup's layout once unmounted`, async () => {
    const errors = []
    const onError = event => errors.push(event.error ?? event)
    window.addEventListener('error', onError)
    const wrapper = mountTrigger()
    await wrapper.setProps({ show: true })
    await waitForTimers()
    wrapper.unmount()
    await waitForTimers()
    window.removeEventListener('error', onError)
    expect(errors).toEqual([])
  })

  it(`stops waiting for the popup's layout after a while`, async () => {
    const wrapper = mountTrigger()
    await wrapper.setProps({ show: true })
    await nextTick()
    // happy-dom doesn't lay out the popup, so it keeps waiting at first:
    expect(wrapper.vm.positionTimer).not.toBe(null)
    await vi.waitFor(() => {
      expect(wrapper.vm.positionTimer).toBe(null)
    })
    wrapper.unmount()
  })
})
