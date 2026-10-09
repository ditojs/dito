import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defaultFormats } from '@ditojs/utils'
import DitoPickerInput from './DitoPickerInput.vue'
import DitoDatePicker from './DitoDatePicker.vue'
import DitoTimePicker from './DitoTimePicker.vue'
import DitoDateTimePicker from './DitoDateTimePicker.vue'

const keyCodes = { ArrowUp: 38, ArrowDown: 40, Enter: 13 }

const dateFormatOptions = {
  locale: 'en-US',
  date: defaultFormats.date,
  time: false
}

function mountPickerInput(props = {}, options = {}) {
  return mount(DitoPickerInput, {
    props: {
      modelValue: new Date(2024, 2, 5),
      formatOptions: dateFormatOptions,
      icon: 'calendar',
      toggleLabel: 'Choose date',
      ...props
    },
    slots: { popup: '<div class="panel">Panel</div>' },
    attachTo: document.body,
    ...options
  })
}

function findInput(wrapper) {
  return wrapper.find('input')
}

function findToggle(wrapper) {
  return wrapper.find('.dito-picker-input__toggle')
}

function isPopupShown(wrapper) {
  return findToggle(wrapper).attributes('aria-expanded') === 'true'
}

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

function getEmittedDates(wrapper) {
  return (wrapper.emitted('update:modelValue') ?? []).map(([date]) => date)
}

describe('DitoPickerInput', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('renders the formatted value, or an empty text without one', async () => {
    wrapper = mountPickerInput({ placeholder: 'Publication date' })
    expect(findInput(wrapper).element.value).toBe('March 5, 2024')
    await wrapper.setProps({ modelValue: null })
    expect(findInput(wrapper).element.value).toBe('')
    expect(findInput(wrapper).attributes('placeholder')).toBe(
      'Publication date'
    )
  })

  it('labels the toggle and renders its icon', () => {
    wrapper = mountPickerInput()
    const toggle = findToggle(wrapper)
    expect(toggle.attributes('aria-label')).toBe('Choose date')
    expect(toggle.find('.dito-icon--calendar').exists()).toBe(true)
  })

  it('follows changes of the model value, ignoring equal dates', async () => {
    wrapper = mountPickerInput()
    await wrapper.setProps({ modelValue: new Date(2024, 2, 5) })
    await wrapper.setProps({ modelValue: new Date(2025, 0, 9) })
    expect(findInput(wrapper).element.value).toBe('January 9, 2025')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('emits `update:modelValue` and `change` for typed dates', async () => {
    wrapper = mountPickerInput()
    await findInput(wrapper).setValue('April 1, 2024')
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [new Date(2024, 3, 1)]
    ])
    expect(wrapper.emitted('change')).toEqual([[new Date(2024, 3, 1)]])
  })

  it(`doesn't emit typed dates that equal the model value`, async () => {
    // The parent doesn't apply the emitted values, so it still has the
    // original date when it is typed again:
    wrapper = mountPickerInput()
    await findInput(wrapper).setValue('April 1, 2024')
    await findInput(wrapper).setValue('March 5, 2024')
    expect(findInput(wrapper).element.value).toBe('March 5, 2024')
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 3, 1)])
  })

  it('ignores text that is no date or the current date', async () => {
    wrapper = mountPickerInput()
    await findInput(wrapper).setValue('next tuesday')
    await findInput(wrapper).setValue('March 5, 2024')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps the caret in place while the typed text is reformatted', async () => {
    wrapper = mountPickerInput()
    const input = findInput(wrapper).element
    input.value = 'March 15, 2024'
    input.setSelectionRange(8, 8)
    await findInput(wrapper).trigger('input')
    await flushPromises()
    expect(input.value).toBe('March 15, 2024')
    expect(input.selectionStart).toBe(8)
  })

  it(`doesn't emit when the parent already has the value`, async () => {
    const date = new Date(2024, 2, 5)
    wrapper = mountPickerInput({ modelValue: null })
    // E.g. the parent changed the value while the text wasn't updated yet:
    wrapper.vm.currentValue = new Date(2024, 0, 1)
    await wrapper.setProps({ modelValue: date })
    expect(wrapper.vm.setValue(new Date(2024, 2, 5))).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('allows clearing the value', () => {
    wrapper = mountPickerInput({ isValueDisabled: () => true })
    expect(wrapper.vm.setValue(null)).toBe(true)
    expect(getEmittedDates(wrapper)).toEqual([null])
  })

  it('opens the popup with the arrow keys, without changing the value', async () => {
    const handlePanelKey = vi.fn(() => true)
    wrapper = mountPickerInput({ handlePanelKey })
    const event = await pressKey(wrapper, 'ArrowDown', 1)
    expect(event.defaultPrevented).toBe(true)
    expect(isPopupShown(wrapper)).toBe(true)
    expect(handlePanelKey).not.toHaveBeenCalled()
  })

  it(`doesn't open the popup with Enter`, async () => {
    wrapper = mountPickerInput()
    const event = await pressKey(wrapper, 'Enter', 1)
    expect(event.defaultPrevented).toBe(true)
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('passes keys to the panel with the date part at the caret', async () => {
    const handlePanelKey = vi.fn(() => false)
    wrapper = mountPickerInput({ show: true, handlePanelKey })
    await pressKey(wrapper, 'ArrowUp', 7)
    expect(handlePanelKey).toHaveBeenCalledWith(
      expect.any(KeyboardEvent),
      expect.objectContaining({ name: 'day' })
    )
  })

  it('handles keys without a panel', async () => {
    wrapper = mountPickerInput({ show: true })
    const event = await pressKey(wrapper, 'ArrowUp', 7)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('emits the date part at the caret when it changes', async () => {
    wrapper = mountPickerInput()
    const input = findInput(wrapper)
    input.element.setSelectionRange(1, 1)
    await input.trigger('keyup')
    input.element.setSelectionRange(2, 2)
    await input.trigger('keyup')
    input.element.setSelectionRange(7, 7)
    await input.trigger('keyup')
    expect(wrapper.emitted('caretPartChange')).toEqual([['month'], ['day']])
  })

  it('reopens the popup when clicking into the input', async () => {
    wrapper = mountPickerInput()
    findInput(wrapper).element.focus()
    await flushPromises()
    await findInput(wrapper).trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
    await findInput(wrapper).trigger('click')
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(true)
  })

  it('disables the input and the toggle', async () => {
    wrapper = mountPickerInput({ disabled: true })
    expect(findInput(wrapper).element.disabled).toBe(true)
    expect(findToggle(wrapper).element.disabled).toBe(true)
    wrapper.vm.open()
    await flushPromises()
    expect(isPopupShown(wrapper)).toBe(false)
  })

  it('passes the input attributes and class to the input', () => {
    wrapper = mountPickerInput({
      inputClass: 'release-date',
      inputAttributes: { 'name': 'releaseDate', 'aria-describedby': 'hint' }
    })
    expect(wrapper.find('.dito-input').classes()).toContain('release-date')
    expect(findInput(wrapper).attributes()).toMatchObject({
      'name': 'releaseDate',
      'aria-describedby': 'hint'
    })
  })

  it('renders the prefix and suffix slots', () => {
    wrapper = mountPickerInput(
      {},
      {
        slots: {
          prefix: '<span class="prefix">From</span>',
          suffix: '<span class="suffix">UTC</span>',
          popup: '<div>Panel</div>'
        }
      }
    )
    expect(wrapper.find('.prefix').exists()).toBe(true)
    expect(wrapper.find('.suffix').exists()).toBe(true)
  })

  it('focuses and blurs the input', async () => {
    wrapper = mountPickerInput()
    wrapper.vm.focus()
    await flushPromises()
    expect(document.activeElement).toBe(findInput(wrapper).element)
    expect(wrapper.find('.dito-input').classes()).toContain('dito-input--focus')
    wrapper.vm.blur()
    await flushPromises()
    expect(document.activeElement).not.toBe(findInput(wrapper).element)
    expect(wrapper.emitted('focus')).toHaveLength(1)
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('has no caret part with a custom trigger', () => {
    wrapper = mountPickerInput(
      {},
      {
        slots: {
          trigger: '<button class="custom">Pick</button>',
          popup: '<div>Panel</div>'
        }
      }
    )
    expect(wrapper.vm.getInputElement()).toBe(null)
    expect(wrapper.vm.getCaretPart()).toBe(null)
    // Without an input, focus() and blur() do nothing:
    expect(() => wrapper.vm.focus()).not.toThrow()
    expect(() => wrapper.vm.blur()).not.toThrow()
  })
})

describe('DitoDatePicker, DitoTimePicker and DitoDateTimePicker', () => {
  for (const [name, component] of Object.entries({
    DitoDatePicker,
    DitoTimePicker,
    DitoDateTimePicker
  })) {
    it(`${name} focuses and blurs its input`, async () => {
      const wrapper = mount(component, {
        props: { modelValue: new Date(2024, 2, 5, 10, 30) },
        attachTo: document.body
      })
      const input = findInput(wrapper).element
      wrapper.vm.focus()
      await flushPromises()
      expect(document.activeElement).toBe(input)
      wrapper.vm.blur()
      await flushPromises()
      expect(document.activeElement).not.toBe(input)
      expect(wrapper.emitted('focus')).toHaveLength(1)
      expect(wrapper.emitted('blur')).toHaveLength(1)
      wrapper.unmount()
    })
  }

  it('DitoDatePicker formats the date in other locales', () => {
    const wrapper = mount(DitoDatePicker, {
      props: { modelValue: new Date(2024, 2, 5), locale: 'de-DE' }
    })
    expect(findInput(wrapper).element.value).toBe('5. März 2024')
  })

  it('DitoDatePicker passes keys to the calendar only while it is shown', async () => {
    const wrapper = mount(DitoDatePicker, {
      props: { modelValue: new Date(2024, 2, 5) },
      attachTo: document.body
    })
    expect(
      wrapper.vm.handlePanelKey(
        new KeyboardEvent('keydown', { keyCode: keyCodes.ArrowDown }),
        { name: 'day' }
      )
    ).toBe(false)
    wrapper.unmount()
  })

  it('DitoDateTimePicker merges custom formats with its defaults', () => {
    const wrapper = mount(DitoDateTimePicker, {
      props: {
        modelValue: new Date(2024, 2, 5, 14, 30),
        format: { date: { month: 'long' } }
      }
    })
    // The date and time are separated by a comma rather than "at":
    expect(findInput(wrapper).element.value).toMatch(
      /^March 5, 2024, 02:30:00\s?PM$/
    )
    wrapper.unmount()
  })

  it('DitoDateTimePicker applies custom date format functions', () => {
    const wrapper = mount(DitoDateTimePicker, {
      props: {
        modelValue: new Date(2024, 2, 5, 14, 30),
        format: {
          date: {
            month: 'long',
            format: (value, type) => (type === 'month' ? 'MARCH' : value)
          }
        }
      }
    })
    expect(findInput(wrapper).element.value).toMatch(/^MARCH 5, 2024, 02:30/)
    wrapper.unmount()
  })

  it('DitoDateTimePicker accepts `true` for the default date format', () => {
    const wrapper = mount(DitoDateTimePicker, {
      props: {
        modelValue: new Date(2024, 2, 5, 14, 30),
        format: { date: true }
      }
    })
    expect(findInput(wrapper).element.value).toMatch(/^March 5, 2024/)
    wrapper.unmount()
  })

  it(`DitoDateTimePicker doesn't pass keys of the other panel`, async () => {
    const wrapper = mount(DitoDateTimePicker, {
      props: { modelValue: new Date(2024, 2, 5, 14, 30) },
      attachTo: document.body
    })
    const event = new KeyboardEvent('keydown', { keyCode: keyCodes.ArrowDown })
    // The date panel is active, so time parts aren't handled:
    expect(wrapper.vm.handlePanelKey(event, { name: 'minute' })).toBe(false)
    // And the calendar isn't shown yet:
    expect(wrapper.vm.handlePanelKey(event, { name: 'day' })).toBe(false)
    wrapper.unmount()
  })
})
