import { vi } from 'vitest'
import { h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { PopoverTrigger } from 'reka-ui'
import DitoTrigger from './DitoTrigger.vue'
import { isPopupShown } from '../test/trigger.js'
import { click, pressKey, pointerDown } from '../test/events.js'

function mountTrigger({
  popup = '<div class="content"><button class="action">Go</button></div>',
  props = {}
} = {}) {
  return mount(DitoTrigger, {
    props,
    slots: {
      trigger: () => [
        h('input', { class: 'input' }),
        h(PopoverTrigger, { class: 'button' }, () => 'Open')
      ],
      popup
    },
    attachTo: document.body
  })
}

function findButton(wrapper) {
  return wrapper.find('.button')
}

async function openPopup(wrapper) {
  await click(findButton(wrapper).element)
}

async function waitForFocus(element) {
  await vi.waitFor(() => expect(document.activeElement).toBe(element))
}

describe('DitoTrigger', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('opens and closes with the button in the trigger', async () => {
    wrapper = mountTrigger()
    expect(wrapper.find('.content').exists()).toBe(false)
    await openPopup(wrapper)
    expect(isPopupShown(wrapper)).toBe(true)
    expect(findButton(wrapper).attributes('aria-expanded')).toBe('true')
    await click(findButton(wrapper).element)
    expect(isPopupShown(wrapper)).toBe(false)
    expect(wrapper.emitted('update:show')).toEqual([[true], [false]])
  })

  it(`doesn't open when its input gets the focus`, async () => {
    wrapper = mountTrigger()
    wrapper.find('.input').element.focus()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it(`doesn't open when disabled`, async () => {
    wrapper = mountTrigger({ props: { disabled: true } })
    await openPopup(wrapper)
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('shows the popup with `show`', async () => {
    wrapper = mountTrigger({ props: { show: true } })
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
    await wrapper.setProps({ show: false })
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('opens and closes the popup through its methods', async () => {
    wrapper = mountTrigger()
    wrapper.vm.open()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
    wrapper.vm.close()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('moves the focus into the popup', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    await waitForFocus(wrapper.find('.action').element)
  })

  it('focuses the element of the popup with `data-autofocus` first', async () => {
    wrapper = mountTrigger({
      popup:
        '<div><button>Back</button><button data-autofocus>Day</button></div>'
    })
    await openPopup(wrapper)
    await waitForFocus(wrapper.find('[data-autofocus]').element)
  })

  it('closes with Escape and returns the focus to the button', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    await waitForFocus(wrapper.find('.action').element)
    await pressKey('Escape')
    expect(isPopupShown(wrapper)).toBe(false)
    await waitForFocus(findButton(wrapper).element)
  })

  it('stays open on presses in the popup and closes on ones outside', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    await pointerDown(wrapper.find('.action').element)
    expect(isPopupShown(wrapper)).toBe(true)
    await pointerDown(document.body)
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('places the popup by `placement`', async () => {
    wrapper = mountTrigger({ props: { placement: 'top-right' } })
    await openPopup(wrapper)
    expect(wrapper.find('.dito-popup').attributes()).toMatchObject({
      'data-side': 'top',
      'data-align': 'end'
    })
  })

  it(`matches the popup's width to the target unless told not to`, async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    expect(wrapper.find('.dito-popup').classes()).toContain(
      'dito-popup--match-width'
    )
    wrapper.unmount()
    wrapper = mountTrigger({ props: { matchTargetWidth: false } })
    await openPopup(wrapper)
    expect(wrapper.find('.dito-popup').classes()).not.toContain(
      'dito-popup--match-width'
    )
  })

  it('animates the popup with `transition`', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    expect(wrapper.find('.dito-popup').classes()).toContain(
      'dito-popup--slide'
    )
    wrapper.unmount()
    wrapper = mountTrigger({ props: { transition: null } })
    await openPopup(wrapper)
    expect(wrapper.find('.dito-popup').classes()).not.toContain(
      'dito-popup--slide'
    )
  })
})
