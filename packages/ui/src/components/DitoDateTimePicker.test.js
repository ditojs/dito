import { mount, flushPromises } from '@vue/test-utils'
import DitoDateTimePicker from './DitoDateTimePicker.vue'

const keyCodes = { ArrowUp: 38, ArrowDown: 40 }

function mountDateTimePicker(props = {}) {
  return mount(DitoDateTimePicker, {
    props: { modelValue: new Date(2024, 2, 5, 14, 30, 0), ...props },
    attachTo: document.body
  })
}

function findInput(wrapper) {
  return wrapper.find('input')
}

function getShownPanel(wrapper) {
  return wrapper.find('.dito-calendar').exists()
    ? 'date'
    : wrapper.find('.dito-time-picker-popup').exists()
      ? 'time'
      : null
}

// Moves the caret in the input to `position`, as a click would.
async function clickAt(wrapper, position) {
  const input = findInput(wrapper).element
  input.focus()
  input.setSelectionRange(position, position)
  await findInput(wrapper).trigger('click')
  await flushPromises()
}

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

describe('DitoDateTimePicker', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('shows the panel of the part at the caret', async () => {
    wrapper = mountDateTimePicker()
    const text = findInput(wrapper).element.value
    expect(text).toMatch(/^Mar 5, 2024, 02:30:00/)
    await clickAt(wrapper, 1)
    expect(getShownPanel(wrapper)).toBe('date')
    const popup = wrapper.find('.dito-popup')
    expect(popup.classes()).toContain('dito-popup-bottom-left')
    await clickAt(wrapper, text.indexOf('30'))
    expect(getShownPanel(wrapper)).toBe('time')
    expect(popup.classes()).toContain('dito-popup-bottom-right')
  })

  it('reopens for the other panel only', async () => {
    wrapper = mountDateTimePicker()
    const text = findInput(wrapper).element.value
    await clickAt(wrapper, 1)
    await findInput(wrapper).trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(getShownPanel(wrapper)).toBe(null)
    const input = findInput(wrapper)
    input.element.setSelectionRange(5, 5)
    await input.trigger('keyup', { key: 'ArrowRight' })
    expect(getShownPanel(wrapper)).toBe(null)
    input.element.setSelectionRange(text.indexOf('30'), text.indexOf('30'))
    await input.trigger('keyup', { key: 'ArrowRight' })
    await flushPromises()
    expect(getShownPanel(wrapper)).toBe('time')
  })

  it('steps the parts of the date and the time', async () => {
    wrapper = mountDateTimePicker()
    const text = findInput(wrapper).element.value
    await clickAt(wrapper, 5)
    await pressKey(wrapper, 'ArrowDown', 5)
    await clickAt(wrapper, text.indexOf('30'))
    await pressKey(wrapper, 'ArrowDown', text.indexOf('30'))
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [new Date(2024, 2, 6, 14, 30, 0)],
      [new Date(2024, 2, 6, 14, 31, 0)]
    ])
  })
})
