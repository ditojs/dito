import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DitoTimePicker from './DitoTimePicker.vue'
import DitoTimePanel from './DitoTimePanel.vue'

const keyCodes = { ArrowUp: 38, ArrowDown: 40, Enter: 13 }

function mountTimePicker(props = {}) {
  return mount(DitoTimePicker, {
    props: { modelValue: new Date(2024, 2, 5, 10, 30, 0), ...props },
    attachTo: document.body
  })
}

function findInput(wrapper) {
  return wrapper.find('input')
}

async function focusInput(wrapper) {
  findInput(wrapper).element.focus()
  await flushPromises()
}

// Presses `key` in the input with the caret at `position`.
async function pressKey(wrapper, key, position) {
  const input = findInput(wrapper).element
  input.setSelectionRange(position, position)
  const event = new KeyboardEvent('keydown', {
    key,
    keyCode: keyCodes[key],
    bubbles: true,
    cancelable: true
  })
  input.dispatchEvent(event)
  await flushPromises()
  return event
}

function getEmittedHours(wrapper) {
  return (wrapper.emitted('update:modelValue') ?? []).map(
    ([date]) => date.getHours()
  )
}

describe('DitoTimePicker', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('passes keys to the time panel only while it is shown', async () => {
    wrapper = mountTimePicker()
    const event = new KeyboardEvent('keydown', { keyCode: keyCodes.ArrowUp })
    expect(wrapper.vm.handlePanelKey(event, { name: 'hour' })).toBe(false)
    await focusInput(wrapper)
    expect(wrapper.vm.handlePanelKey(event, { name: 'hour' })).toBe(true)
    expect(getEmittedHours(wrapper)).toEqual([9])
  })

  it('closes the popup with Enter', async () => {
    wrapper = mountTimePicker()
    await focusInput(wrapper)
    expect(wrapper.find('.dito-time-picker-popup').exists()).toBe(true)
    const event = await pressKey(wrapper, 'Enter', 1)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.find('.dito-time-picker-popup').exists()).toBe(false)
  })

  it('overwrites digits instead of inserting them', async () => {
    wrapper = mountTimePicker()
    await focusInput(wrapper)
    const input = findInput(wrapper).element
    await pressKey(wrapper, '2', 1)
    expect(input.value).toMatch(/^1:30:00/)
    expect(input.selectionStart).toBe(1)
  })
})

describe('DitoTimePanel', () => {
  it('centers the selected options by their position', async () => {
    const wrapper = mount(DitoTimePanel, {
      props: {
        modelValue: new Date(2024, 2, 5, 10, 30, 0)
      },
      attachTo: document.body
    })
    const list = wrapper.find('.dito-time-picker-hour').element
    list.scrollTo = vi.fn()
    Object.defineProperty(list, 'clientHeight', { value: 168 })
    const options = wrapper.findAll('.dito-time-picker-hour li')
    for (const [index, option] of options.entries()) {
      // The first option has a margin of three options.
      Object.defineProperty(option.element, 'offsetTop', {
        value: (index + 3) * 24
      })
      Object.defineProperty(option.element, 'offsetHeight', { value: 24 })
    }
    await wrapper.setProps({ modelValue: new Date(2024, 2, 5, 12, 30, 0) })
    await flushPromises()
    expect(list.scrollTo).toHaveBeenCalledWith({
      top: 12 * 24,
      behavior: 'auto'
    })
    wrapper.unmount()
  })
})
