import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DitoTimePicker from './DitoTimePicker.vue'
import DitoTimePanel from './DitoTimePanel.vue'
import { click } from '../test/events.js'

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

async function waitForFocus(element) {
  await vi.waitFor(() => expect(document.activeElement).toBe(element))
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

  it('moves the focus to the hours, and closes with Enter in them', async () => {
    wrapper = mountTimePicker()
    const toggle = wrapper.find('.dito-picker-input__toggle')
    await click(toggle.element)
    const hours = wrapper.find('.dito-time-picker-hour')
    await waitForFocus(hours.element)
    await hours.trigger('keydown', {
      key: 'ArrowUp',
      keyCode: keyCodes.ArrowUp
    })
    expect(getEmittedHours(wrapper)).toEqual([9])
    await hours.trigger('keydown', { key: 'Enter', keyCode: keyCodes.Enter })
    await flushPromises()
    expect(wrapper.find('.dito-time-picker-popup').exists()).toBe(false)
    await waitForFocus(toggle.element)
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
