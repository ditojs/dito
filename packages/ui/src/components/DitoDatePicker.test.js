import { mount, flushPromises } from '@vue/test-utils'
import DitoDatePicker from './DitoDatePicker.vue'

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

function isPopupShown(wrapper) {
  return wrapper.find('.dito-calendar').exists()
}

async function focusInput(wrapper) {
  findInput(wrapper).element.focus()
  await flushPromises()
}

// Presses `key` in the input with the caret at `position`.
async function pressKey(wrapper, key, position) {
  const input = findInput(wrapper).element
  input.setSelectionRange(position, position)
  input.dispatchEvent(
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
    await toggle.trigger('click')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(isPopupShown(wrapper)).toBe(true)
    expect(document.activeElement).toBe(findInput(wrapper).element)
    await toggle.trigger('click')
    await flushPromises()
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

  it('opens on focus and emits `focus` and `blur` once', async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    expect(isPopupShown(wrapper)).toBe(true)
    expect(wrapper.emitted('update:show')).toEqual([[true]])
    findInput(wrapper).element.blur()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
    expect(wrapper.emitted('focus')).toHaveLength(1)
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('steps the date part at the caret, skipping disabled dates', async () => {
    wrapper = mountDatePicker({
      disabledDate: date => date.getDate() === 6
    })
    await focusInput(wrapper)
    // "March 5, 2024": The caret in the day.
    await pressKey(wrapper, 'ArrowDown', 7)
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 2, 7)])
  })

  it(`doesn't select disabled dates when typed`, async () => {
    wrapper = mountDatePicker({
      disabledDate: date => date.getDate() === 6
    })
    await focusInput(wrapper)
    await findInput(wrapper).setValue('March 6, 2024')
    expect(getEmittedDates(wrapper)).toEqual([])
    await findInput(wrapper).setValue('March 7, 2024')
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 2, 7)])
  })

  it('selects the date with Enter and closes the popup', async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    await pressKey(wrapper, 'ArrowDown', 7)
    await pressKey(wrapper, 'Enter', 7)
    expect(getEmittedDates(wrapper).at(-1)).toEqual(new Date(2024, 2, 6))
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('stays open while the focus moves into the calendar', async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    const cell = wrapper.find('[role="gridcell"][tabindex="0"]').element
    cell.focus()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
    // Leaving both closes the popup:
    cell.blur()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('returns the focus to the input after selecting in the calendar', async () => {
    wrapper = mountDatePicker()
    await focusInput(wrapper)
    const cell = wrapper.find('[role="gridcell"][tabindex="0"]')
    cell.element.focus()
    await cell.trigger('click')
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
    expect(document.activeElement).toBe(findInput(wrapper).element)
    expect(wrapper.emitted('blur')).toBeUndefined()
  })
})
