import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import DitoTrigger from './DitoTrigger.vue'

// happy-dom doesn't lay out elements, so the sizes are faked:
const popupWidth = 80
const popupHeight = 40

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

function setBounds(element, { left, top, width, height }) {
  element.getBoundingClientRect = () => ({ left, top, width, height })
}

async function mountShownTrigger(props = {}, bounds = {}) {
  const wrapper = mount(DitoTrigger, {
    props: { show: true, matchTargetWidth: false, ...props },
    slots: {
      trigger: '<button class="open">Open</button>',
      popup: '<div class="content">Chapters</div>'
    },
    attachTo: document.body
  })
  await nextTick()
  setBounds(wrapper.find('.dito-trigger').element, {
    left: 100,
    top: 100,
    width: 50,
    height: 20,
    ...bounds
  })
  const popup = wrapper.find('.dito-popup').element
  Object.defineProperty(popup, 'offsetWidth', { value: popupWidth })
  Object.defineProperty(popup, 'offsetHeight', { value: popupHeight })
  return wrapper
}

// Positions the popup and returns its offset to the trigger.
async function getPosition(props, bounds) {
  const wrapper = await mountShownTrigger(props, bounds)
  wrapper.vm.updatePosition()
  const { left, top } = wrapper.find('.dito-popup').element.style
  wrapper.unmount()
  return { left: parseFloat(left), top: parseFloat(top) }
}

describe('DitoTrigger positioning', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('without keeping the popup in view', () => {
    const position = placement => getPosition({ placement, keepInView: false })

    it('places the popup on the side given by the placement', async () => {
      expect(await position('bottom')).toEqual({ left: 0, top: 20 })
      expect(await position('top')).toEqual({ left: 0, top: -popupHeight })
      expect(await position('left')).toEqual({ left: -popupWidth, top: 0 })
      expect(await position('right')).toEqual({ left: 50, top: 0 })
    })

    it('aligns the popup with the edge given by the placement', async () => {
      expect(await position('bottom-left')).toEqual({ left: 0, top: 20 })
      expect(await position('bottom-right')).toEqual({ left: -30, top: 20 })
      expect(await position('right-top')).toEqual({ left: 50, top: 0 })
      expect(await position('right-bottom')).toEqual({ left: 50, top: -20 })
    })

    it('covers the trigger with `cover`', async () => {
      expect(
        await getPosition({ placement: 'bottom', cover: true })
      ).toEqual({ left: 0, top: 0 })
      expect(
        await getPosition({ placement: 'top', cover: true })
      ).toEqual({ left: 0, top: -20 })
      // Only applies to placements above or below:
      expect(
        await getPosition({ placement: 'left', cover: true, keepInView: false })
      ).toEqual({ left: -popupWidth, top: 0 })
    })

    it(`doesn't flip popups that don't fit`, async () => {
      expect(
        await getPosition(
          { placement: 'bottom', keepInView: false },
          { top: window.innerHeight - 25 }
        )
      ).toEqual({ left: 0, top: 20 })
    })
  })

  describe('keeping the popup in view', () => {
    const { innerWidth, innerHeight } = window

    it('keeps popups that fit on their side', async () => {
      expect(await getPosition({ placement: 'bottom' })).toEqual({
        left: 0,
        top: 20
      })
    })

    it('flips popups between top and bottom', async () => {
      expect(
        await getPosition({ placement: 'bottom' }, { top: innerHeight - 25 })
      ).toEqual({ left: 0, top: -popupHeight })
      expect(
        await getPosition({ placement: 'top' }, { top: 10 })
      ).toEqual({ left: 0, top: 20 })
    })

    it('flips popups between left and right', async () => {
      expect(
        await getPosition({ placement: 'left' }, { left: 10 })
      ).toEqual({ left: 50, top: 0 })
      expect(
        await getPosition({ placement: 'right' }, { left: innerWidth - 60 })
      ).toEqual({ left: -popupWidth, top: 0 })
    })

    it('flips the horizontal alignment', async () => {
      expect(
        await getPosition(
          { placement: 'bottom-left' },
          { left: innerWidth - 60 }
        )
      ).toEqual({ left: -30, top: 20 })
      expect(
        await getPosition({ placement: 'bottom-right' }, { left: 10 })
      ).toEqual({ left: 0, top: 20 })
    })

    it('flips the vertical alignment', async () => {
      expect(
        await getPosition({ placement: 'right-top' }, { top: innerHeight - 30 })
      ).toEqual({ left: 50, top: -20 })
      expect(
        await getPosition({ placement: 'right-bottom' }, { top: 5 })
      ).toEqual({ left: 50, top: 0 })
    })

    it(`doesn't flip when the other side has even less room`, async () => {
      // A trigger that is nearly as high as the window:
      expect(
        await getPosition(
          { placement: 'bottom' },
          { top: 10, height: innerHeight - 30 }
        )
      ).toEqual({ left: 0, top: innerHeight - 30 })
    })
  })

  it('positions the popup relative to the trigger for other targets', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    setBounds(target, { left: 300, top: 200, width: 60, height: 30 })
    expect(
      await getPosition({ placement: 'bottom-left', target, keepInView: false })
    ).toEqual({ left: 200, top: 130 })
    target.remove()
  })

  it(`doesn't position hidden popups or popups that aren't laid out`, async () => {
    const wrapper = mount(DitoTrigger, {
      props: { show: true },
      slots: { trigger: '<button>Open</button>', popup: '<div>Popup</div>' },
      attachTo: document.body
    })
    await nextTick()
    const popup = wrapper.find('.dito-popup').element
    // Not laid out yet, `offsetWidth` is 0:
    wrapper.vm.updatePosition()
    expect(popup.style.top).toBe('')
    wrapper.unmount()
  })

  it('applies the placement, custom class and z-index to the popup', async () => {
    const wrapper = await mountShownTrigger({
      placement: 'bottom-right',
      customClass: 'book-menu',
      zIndex: 20
    })
    const popup = wrapper.find('.dito-popup')
    expect(popup.classes()).toEqual(
      expect.arrayContaining(['dito-popup-bottom-right', 'book-menu'])
    )
    expect(popup.element.style.zIndex).toBe('20')
    wrapper.unmount()
  })
})

describe('DitoTrigger in hover mode', () => {
  function mountHoverTrigger(props = {}) {
    return mount(DitoTrigger, {
      props: { trigger: 'hover', ...props },
      slots: {
        trigger: '<span class="title">Title</span>',
        popup: '<div class="content">Summary</div>'
      },
      attachTo: document.body
    })
  }

  function isShown(wrapper) {
    return wrapper.find('.dito-trigger').attributes('aria-expanded') === 'true'
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the popup while hovering the trigger', async () => {
    const wrapper = mountHoverTrigger()
    await wrapper.find('.dito-trigger').trigger('mouseenter')
    expect(isShown(wrapper)).toBe(true)
    expect(wrapper.find('.content').exists()).toBe(true)
    await wrapper.find('.dito-trigger').trigger('mouseleave')
    expect(isShown(wrapper)).toBe(false)
    expect(wrapper.find('.content').exists()).toBe(false)
    expect(wrapper.emitted('update:show')).toEqual([[true], [false]])
    wrapper.unmount()
  })

  it('hides the popup after `hideDelay`', async () => {
    vi.useFakeTimers()
    const wrapper = mountHoverTrigger({ hideDelay: 200 })
    await wrapper.find('.dito-trigger').trigger('mouseenter')
    await wrapper.find('.dito-trigger').trigger('mouseleave')
    vi.advanceTimersByTime(199)
    await nextTick()
    expect(isShown(wrapper)).toBe(true)
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(isShown(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it('stays shown when moving from the trigger into the popup', async () => {
    vi.useFakeTimers()
    const wrapper = mountHoverTrigger({ hideDelay: 200 })
    await wrapper.find('.dito-trigger').trigger('mouseenter')
    await wrapper.find('.dito-trigger').trigger('mouseleave')
    await wrapper.find('.dito-popup').trigger('mouseenter')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(isShown(wrapper)).toBe(true)
    await wrapper.find('.dito-popup').trigger('mouseleave')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(isShown(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it(`doesn't show when disabled`, async () => {
    const wrapper = mountHoverTrigger({ disabled: true })
    await wrapper.find('.dito-trigger').trigger('mouseenter')
    expect(isShown(wrapper)).toBe(false)
    expect(wrapper.find('.dito-trigger').classes()).toContain(
      'dito-trigger-disabled'
    )
    wrapper.unmount()
  })
})

describe('DitoTrigger with `alwaysShow`', () => {
  function mountAlwaysShown(props = {}) {
    return mount(DitoTrigger, {
      props: { alwaysShow: true, ...props },
      slots: {
        trigger: '<button class="open">Open</button>',
        popup: '<div class="content"><button class="inner">X</button></div>'
      },
      attachTo: document.body
    })
  }

  it('shows the popup from the start and keeps it shown', async () => {
    const wrapper = mountAlwaysShown()
    await nextTick()
    expect(wrapper.find('.content').exists()).toBe(true)
    expect(wrapper.emitted('update:show')).toEqual([[true]])
    // The trigger isn't a toggle:
    expect(wrapper.find('.dito-trigger').attributes('aria-expanded')).toBe(
      undefined
    )
    wrapper.vm.close()
    wrapper.vm.toggle()
    await wrapper.setProps({ show: false })
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.content').exists()).toBe(true)
    wrapper.unmount()
  })

  it('lets Escape propagate', async () => {
    const onKeyDown = vi.fn()
    document.body.addEventListener('keydown', onKeyDown)
    const wrapper = mountAlwaysShown()
    await nextTick()
    await wrapper.find('.inner').trigger('keydown', { key: 'Escape' })
    expect(onKeyDown).toHaveBeenCalledOnce()
    expect(wrapper.find('.content').exists()).toBe(true)
    document.body.removeEventListener('keydown', onKeyDown)
    wrapper.unmount()
  })
})

describe('DitoTrigger closing', () => {
  function mountClickTrigger(props = {}) {
    return mount(DitoTrigger, {
      props,
      slots: {
        trigger: '<button class="open">Open</button>',
        popup: '<div class="content">Popup</div>'
      },
      attachTo: document.body
    })
  }

  function isShown(wrapper) {
    return wrapper.find('.dito-trigger').attributes('aria-expanded') === 'true'
  }

  it('closes when the window loses the focus', async () => {
    const wrapper = mountClickTrigger()
    await wrapper.find('.dito-trigger').trigger('click')
    await nextTick()
    window.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(isShown(wrapper)).toBe(false)
    wrapper.unmount()
  })

  it(`stays open on clicks outside with \`hideWhenClickOutside: false\``, async () => {
    const wrapper = mountClickTrigger({ hideWhenClickOutside: false })
    await wrapper.find('.dito-trigger').trigger('click')
    await nextTick()
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()
    expect(isShown(wrapper)).toBe(true)
    wrapper.unmount()
  })

  it('follows the `show` prop', async () => {
    const wrapper = mountClickTrigger()
    await wrapper.setProps({ show: true })
    expect(isShown(wrapper)).toBe(true)
    await wrapper.setProps({ show: false })
    expect(isShown(wrapper)).toBe(false)
    expect(wrapper.emitted('update:show')).toEqual([[true], [false]])
    wrapper.unmount()
  })

  it('ignores Escape while the popup is closed', async () => {
    const wrapper = mountClickTrigger()
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true
    })
    const stopPropagation = vi.spyOn(event, 'stopPropagation')
    wrapper.find('.open').element.dispatchEvent(event)
    expect(stopPropagation).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('removes the close events when unmounted while shown', async () => {
    const wrapper = mountClickTrigger({ show: true })
    await nextTick()
    const { vm } = wrapper
    expect(vm.closeEvents).not.toBe(null)
    const remove = vi.spyOn(vm.closeEvents, 'remove')
    wrapper.unmount()
    expect(remove).toHaveBeenCalledOnce()
    expect(vm.closeEvents).toBe(null)
  })
})
