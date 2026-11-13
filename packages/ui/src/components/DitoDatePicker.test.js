import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DitoDatePicker from './DitoDatePicker.vue'
import { click } from '../test/events.js'

const keyCodes = { ArrowUp: 38, ArrowDown: 40, Enter: 13 }

function mountDatePicker(props = {}) {
  return mount(DitoDatePicker, {
    props: { modelValue: new Date(2024, 2, 5), ...props },
    attachTo: document.body
  })
}

function findInput(wrapper) {
  return wrapper.find('input')
}

function findToggle(wrapper) {
  return wrapper.find('button[aria-haspopup="dialog"]')
}

async function waitForFocus(element) {
  await vi.waitFor(() => expect(document.activeElement).toBe(element))
}

function isPopupShown(wrapper) {
  return wrapper.find('.dito-calendar').exists()
}

async function focusInput(wrapper) {
  findInput(wrapper).element.focus()
  await flushPromises()
}

// Presses `key` in the input with the caret at `position`, or on `element`.
async function pressKey(wrapper, key, position, element) {
  const input = findInput(wrapper).element
  input.setSelectionRange(position, position)
  ;(element ?? input).dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      keyCode: keyCodes[key],
      bubbles: true,
      cancelable: true
    })
  )
  await flushPromises()
}

function getEmittedDates(wrapper) {
  return (wrapper.emitted('update:modelValue') ?? []).map(([date]) => date)
}

describe('DitoDatePicker', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('toggles the popup with its icon button', async () => {
    wrapper = mountDatePicker()
    const toggle = findToggle(wrapper)
    expect(toggle.attributes('type')).toBe('button')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await click(toggle.element)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(isPopupShown(wrapper)).toBe(true)
    await click(toggle.element)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('renders the `trigger` slot in place of the input', () => {
    wrapper = mount(DitoDatePicker, {
      slots: { trigger: '<button class="custom">Pick</button>' }
    })
    expect(wrapper.find('.custom').exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it(`doesn't open on focus`, async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    expect(isPopupShown(wrapper)).toBe(false)
    expect(wrapper.emitted('focus')).toHaveLength(1)
  })

  it('steps the date part at the caret', async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    // "March 5, 2024": The caret in the day.
    await pressKey(wrapper, 'ArrowDown', 7)
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 2, 6)])
  })

  it('moves the focus to the selected day of the calendar', async () => {
    wrapper = mountDatePicker()
    await click(findToggle(wrapper).element)
    await waitForFocus(wrapper.find('[role="gridcell"][tabindex="0"]').element)
    expect(document.activeElement.getAttribute('aria-label')).toBe(
      'March 5, 2024'
    )
  })

  it('returns the focus to the button after selecting a day', async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    const toggle = findToggle(wrapper)
    await click(toggle.element)
    const cell = wrapper.find('[role="gridcell"][tabindex="0"]')
    await waitForFocus(cell.element)
    await cell.trigger('click')
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
    expect(getEmittedDates(wrapper)).toEqual([])
    await waitForFocus(toggle.element)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('focus')).toHaveLength(1)
  })

  it('emits `blur` once the focus leaves the input, button and calendar', async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    await click(findToggle(wrapper).element)
    await waitForFocus(wrapper.find('[role="gridcell"][tabindex="0"]').element)
    await pressKey(wrapper, 'Escape', 0, document.activeElement)
    await waitForFocus(findToggle(wrapper).element)
    expect(wrapper.emitted('blur')).toBeUndefined()
    findToggle(wrapper).element.blur()
    await flushPromises()
    expect(wrapper.emitted('focus')).toHaveLength(1)
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })
})
