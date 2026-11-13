import { mount, flushPromises } from '@vue/test-utils'
import DitoTrigger from './DitoTrigger.vue'
import { isPopupShown } from '../test/trigger.js'

function mountTrigger({
  popup = '<div class="content"><button class="action">Go</button></div>',
  trigger = '<input class="input"><span class="preview"></span>',
  props = {}
} = {}) {
  return mount(DitoTrigger, {
    props,
    slots: { trigger, popup },
    attachTo: document.body
  })
}

async function openPopup(wrapper) {
  wrapper.find('.input').element.focus()
  await flushPromises()
}

function dispatch(element, event) {
  element.dispatchEvent(event)
  return event
}

function mouseDown(element) {
  return dispatch(
    element,
    new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  )
}

function keyDown(element, key) {
  return dispatch(
    element,
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  )
}

describe('DitoTrigger', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('opens when its input gets the focus', async () => {
    wrapper = mountTrigger()
    expect(wrapper.find('.content').exists()).toBe(false)
    await openPopup(wrapper)
    expect(isPopupShown(wrapper)).toBe(true)
    expect(wrapper.emitted('update:show')).toEqual([[true]])
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

  it('opens, closes and toggles the popup through its methods', async () => {
    wrapper = mountTrigger()
    wrapper.vm.open()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
    wrapper.vm.toggle()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
    wrapper.vm.toggle()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
    wrapper.vm.close()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('stays open while the focus moves into the popup', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    const action = wrapper.find('.action').element
    action.focus()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
    // Once the focus leaves trigger and popup, it closes:
    action.blur()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('closes when the input loses the focus', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    wrapper.find('.input').element.blur()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('returns the focus to the input when closing from the popup', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    wrapper.find('.action').element.focus()
    keyDown(wrapper.find('.action').element, 'Escape')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('.input').element)
    // Without opening the popup again:
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('closes with Escape and marks it handled', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    // Escape doesn't also close what contains the trigger, e.g. dialogs:
    const event = keyDown(wrapper.find('.input').element, 'Escape')
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('leaves Escape alone while closed', async () => {
    wrapper = mountTrigger()
    const event = keyDown(wrapper.find('.input').element, 'Escape')
    expect(event.defaultPrevented).toBe(false)
  })

  it('keeps the focus in the input on clicks in the popup', async () => {
    wrapper = mountTrigger({
      popup:
        '<div class="content"><button class="action"></button><input class="field"></div>'
    })
    await openPopup(wrapper)
    expect(mouseDown(wrapper.find('.action').element).defaultPrevented).toBe(
      true
    )
    expect(mouseDown(wrapper.find('.content').element).defaultPrevented).toBe(
      true
    )
    // The fields of the popup take the focus, e.g. those of a color picker:
    expect(mouseDown(wrapper.find('.field').element).defaultPrevented).toBe(
      false
    )
  })

  it('keeps the focus in the input on clicks elsewhere in the trigger', () => {
    wrapper = mountTrigger()
    expect(mouseDown(wrapper.find('.preview').element).defaultPrevented).toBe(
      true
    )
    expect(mouseDown(wrapper.find('.input').element).defaultPrevented).toBe(
      false
    )
  })

  it('stays open on presses in the trigger and closes on ones outside', async () => {
    wrapper = mountTrigger()
    await openPopup(wrapper)
    // reka-ui listens for presses outside the popup after a timeout:
    await new Promise(resolve => setTimeout(resolve))
    const pointerDown = element =>
      dispatch(
        element,
        new PointerEvent('pointerdown', { bubbles: true, button: 0 })
      )
    pointerDown(wrapper.find('.input').element)
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
    pointerDown(document.body)
    await flushPromises()
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
