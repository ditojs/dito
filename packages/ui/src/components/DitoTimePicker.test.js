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

  it('only lists the enabled values', async () => {
    wrapper = mountTimePicker({ disabledHour: hour => hour < 4 })
    await focusInput(wrapper)
    const hours = wrapper.findAll('.dito-time-picker-hour [role="option"]')
    expect(hours.map(hour => hour.text())).toEqual(
      Array.from({ length: 20 }, (_, index) => `${index + 4}`.padStart(2, '0'))
    )
  })

  it('steps through the enabled values only', async () => {
    wrapper = mountTimePicker({ disabledHour: hour => hour % 2 === 1 })
    await focusInput(wrapper)
    // "10:30:00 AM": The caret in the hour.
    await pressKey(wrapper, 'ArrowDown', 1)
    expect(getEmittedHours(wrapper)).toEqual([12])
  })

  it('wraps around at the ends of the enabled values', async () => {
    wrapper = mountTimePicker({
      modelValue: new Date(2024, 2, 5, 4, 30, 0),
      disabledHour: hour => hour < 4
    })
    await focusInput(wrapper)
    await pressKey(wrapper, 'ArrowUp', 1)
    expect(getEmittedHours(wrapper)).toEqual([23])
  })

  it(`doesn't set disabled times when typed`, async () => {
    wrapper = mountTimePicker({ disabledHour: hour => hour === 11 })
    await focusInput(wrapper)
    await findInput(wrapper).setValue('11:30:00 AM')
    expect(getEmittedHours(wrapper)).toEqual([])
    await findInput(wrapper).setValue('09:30:00 AM')
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
  it('moves the other parts onto enabled values when picking one', async () => {
    const wrapper = mount(DitoTimePanel, {
      props: {
        modelValue: null,
        disabledHour: hour => hour < 8,
        disabledMinute: minute => minute === 0
      },
      attachTo: document.body
    })
    // Picking an hour or a minute alone would always hit a disabled part of
    // the initial time, 00:00:00.
    const minutes = wrapper.findAll('.dito-time-picker-minute li')
    await minutes.find(minute => minute.text() === '30').trigger('click')
    const [[date]] = wrapper.emitted('update:modelValue')
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([
      8, 30, 0
    ])
    wrapper.unmount()
  })

  it('centers the selected options by their position', async () => {
    const wrapper = mount(DitoTimePanel, {
      props: {
        modelValue: new Date(2024, 2, 5, 10, 30, 0),
        disabledHour: hour => hour < 4
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
    // 12 is the ninth enabled hour, at index 8.
    expect(list.scrollTo).toHaveBeenCalledWith({
      top: 8 * 24,
      behavior: 'auto'
    })
    wrapper.unmount()
  })
})
