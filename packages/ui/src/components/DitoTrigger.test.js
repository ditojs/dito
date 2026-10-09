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
    // The listener is removed through the signal it was added with:
    const [[, , { signal }]] = getMouseUpCalls(addEventListener)
    expect(signal.aborted).toBe(true)
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

  it('opens, closes and toggles the popup through its methods', async () => {
    const wrapper = mountTrigger()
    const getExpanded = () =>
      wrapper.find('.dito-trigger').attributes('aria-expanded')
    wrapper.vm.open()
    await nextTick()
    expect(getExpanded()).toBe('true')
    wrapper.vm.close()
    await nextTick()
    expect(getExpanded()).toBe('false')
    wrapper.vm.toggle()
    await nextTick()
    expect(getExpanded()).toBe('true')
    wrapper.vm.toggle()
    await nextTick()
    expect(getExpanded()).toBe('false')
    await wrapper.setProps({ disabled: true })
    wrapper.vm.open()
    await nextTick()
    expect(getExpanded()).toBe('false')
    wrapper.unmount()
  })

  describe('in click mode', () => {
    it('toggles the popup with clicks on the trigger', async () => {
      const wrapper = mountTrigger({ trigger: 'click' })
      const trigger = wrapper.find('.dito-trigger')
      await trigger.trigger('click')
      expect(trigger.attributes('aria-expanded')).toBe('true')
      await trigger.trigger('click')
      expect(trigger.attributes('aria-expanded')).toBe('false')
      expect(wrapper.emitted('update:show')).toEqual([[true], [false]])
      wrapper.unmount()
    })

    it('keeps the popup open on clicks inside of it', async () => {
      const wrapper = mountTrigger({ trigger: 'click' })
      await wrapper.find('.dito-trigger').trigger('click')
      await nextTick()
      const content = wrapper.find('.content').element
      content.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      await nextTick()
      expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
        'true'
      )
      wrapper.unmount()
    })

    it(`doesn't open when disabled`, async () => {
      const wrapper = mountTrigger({ trigger: 'click', disabled: true })
      await wrapper.find('.dito-trigger').trigger('click')
      expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
        'false'
      )
      wrapper.unmount()
    })
  })

  describe('positioning', () => {
    // happy-dom's `ResizeObserver` does nothing, so record the observers and
    // notify them by hand.
    let observers
    class FakeResizeObserver {
      constructor(callback) {
        this.callback = callback
        this.elements = []
        observers.push(this)
      }

      observe(element) {
        this.elements.push(element)
      }

      disconnect() {
        this.elements = []
      }

      notify() {
        this.callback([])
      }
    }

    beforeEach(() => {
      observers = []
      vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    // Lays out the popup with the given width, as happy-dom doesn't.
    function layOutPopup(wrapper, width) {
      const popup = wrapper.find('.dito-popup').element
      Object.defineProperty(popup, 'offsetWidth', { value: width })
      Object.defineProperty(popup, 'offsetHeight', { value: 20 })
      return popup
    }

    it('observes the size of the target only while shown', async () => {
      const wrapper = mountTrigger({ trigger: 'click' })
      await nextTick()
      expect(observers).toHaveLength(0)
      await wrapper.find('.dito-trigger').trigger('click')
      await nextTick()
      const trigger = wrapper.find('.dito-trigger').element
      expect(observers).toHaveLength(1)
      expect(observers[0].elements).toEqual([trigger])
      await wrapper.find('.dito-trigger').trigger('click')
      await nextTick()
      expect(observers[0].elements).toEqual([])
      wrapper.unmount()
    })

    it('positions the popup once it is laid out', async () => {
      const wrapper = mountTrigger({ show: true })
      await nextTick()
      const popup = layOutPopup(wrapper, 100)
      expect(popup.style.top).toBe('')
      observers[0].notify()
      expect(popup.style.top).toBe('0px')
      expect(popup.style.left).toBe('0px')
      wrapper.unmount()
    })

    it('positions the popup again when the placement changes', async () => {
      const wrapper = mountTrigger({
        show: true,
        placement: 'bottom-left',
        keepInView: false
      })
      await nextTick()
      const popup = layOutPopup(wrapper, 100)
      observers[0].notify()
      expect(popup.style.left).toBe('0px')
      await wrapper.setProps({ placement: 'bottom-right' })
      await nextTick()
      expect(popup.style.left).toBe('-100px')
      wrapper.unmount()
    })

    it('stops observing the target once unmounted', async () => {
      const wrapper = mountTrigger({ show: true })
      await nextTick()
      const [observer] = observers
      wrapper.unmount()
      expect(observer.elements).toEqual([])
      expect(() => observer.notify()).not.toThrow()
    })

    it(`matches the popup's width to the target unless told not to`, async () => {
      for (const matchTargetWidth of [true, false]) {
        observers = []
        const wrapper = mountTrigger({ show: true, matchTargetWidth })
        await nextTick()
        wrapper.find('.dito-trigger').element.style.width = '120px'
        const popup = layOutPopup(wrapper, 100)
        observers[0].notify()
        expect(popup.firstElementChild.style.width).toBe(
          matchTargetWidth ? '120px' : ''
        )
        wrapper.unmount()
      }
    })

    it('resolves targets given by ref name once mounted', async () => {
      const wrapper = mountTrigger({ show: true, target: 'popup' })
      await nextTick()
      const trigger = wrapper.find('.dito-trigger').element
      trigger.style.width = '120px'
      const popup = layOutPopup(wrapper, 100)
      popup.style.width = '150px'
      expect(observers[0].elements).toEqual([popup])
      observers[0].notify()
      // With the popup as target, the trigger takes on the popup's width.
      expect(trigger.style.width).toBe('150px')
      wrapper.unmount()
    })
  })

  describe('in focus mode', () => {
    function mountFocusTrigger({
      popup = '<div class="content"><input class="field"></div>'
    } = {}) {
      return mount(DitoTrigger, {
        props: { trigger: 'focus' },
        slots: {
          trigger: '<input class="input">',
          popup
        },
        attachTo: document.body
      })
    }

    async function openPopup(wrapper) {
      wrapper.find('.input').element.focus()
      await nextTick()
      await nextTick()
    }

    function pressMouse(element, type) {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true }))
    }

    it('releases the readonly input on mouseup outside of the popup', async () => {
      const wrapper = mountFocusTrigger()
      await openPopup(wrapper)
      const input = wrapper.find('.input').element
      pressMouse(wrapper.find('.content').element, 'mousedown')
      expect(input.hasAttribute('readonly')).toBe(true)
      // E.g. after dragging in a color picker:
      pressMouse(document.body, 'mouseup')
      await waitForTimers()
      expect(input.hasAttribute('readonly')).toBe(false)
      wrapper.unmount()
    })

    it('stays open while the focus moves into the popup', async () => {
      const wrapper = mountFocusTrigger({
        popup: '<div class="content"><button class="action">Go</button></div>'
      })
      await openPopup(wrapper)
      const action = wrapper.find('.action').element
      action.focus()
      await nextTick()
      expect(wrapper.find('.content').exists()).toBe(true)
      // Once the focus leaves trigger and popup, it closes:
      action.blur()
      await nextTick()
      expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
        'false'
      )
      wrapper.unmount()
    })

    it('returns the focus to the input when closing from the popup', async () => {
      const wrapper = mountFocusTrigger({
        popup: '<div class="content"><button class="action">Go</button></div>'
      })
      await openPopup(wrapper)
      wrapper.find('.action').element.focus()
      await wrapper.find('.action').trigger('keydown', { key: 'Escape' })
      await nextTick()
      await nextTick()
      expect(document.activeElement).toBe(wrapper.find('.input').element)
      // Without opening the popup again:
      expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
        'false'
      )
      wrapper.unmount()
    })

    it('keeps the focus in the input on clicks on popup buttons', async () => {
      const wrapper = mountFocusTrigger({
        popup: '<div class="content"><button class="action">Go</button></div>'
      })
      await openPopup(wrapper)
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true
      })
      wrapper.find('.action').element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      wrapper.unmount()
    })

    it('binds the focus events to targets that are set later', async () => {
      const target = document.createElement('div')
      target.innerHTML = '<input class="target-input">'
      document.body.appendChild(target)
      const wrapper = mountFocusTrigger()
      await wrapper.setProps({ target })
      target.querySelector('input').focus()
      await nextTick()
      expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
        'true'
      )
      wrapper.unmount()
      target.remove()
    })

    it(`doesn't mark the input readonly for fields in the popup`, async () => {
      const wrapper = mountFocusTrigger()
      await openPopup(wrapper)
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true
      })
      wrapper.find('.field').element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
      expect(wrapper.find('.input').element.hasAttribute('readonly')).toBe(
        false
      )
      wrapper.unmount()
    })
  })
})
