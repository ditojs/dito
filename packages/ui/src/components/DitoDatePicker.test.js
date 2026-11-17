import { vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { CalendarDate, CalendarDateTime } from '@internationalized/date'
import DitoDatePicker from './DitoDatePicker.vue'

// Mounts the picker and opens its calendar:
async function openCalendar(props) {
  const wrapper = mount(DitoDatePicker, { props, attachTo: document.body })
  await wrapper.find('button[aria-label="Choose date"]').trigger('click')
  await flushPromises()
  return wrapper
}

describe('DitoDatePicker', () => {
  let wrapper

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 4, 14, 9, 30, 45))
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  it.each([
    ['day', 'Today', new CalendarDate(2026, 5, 14)],
    ['minute', 'Now', new CalendarDateTime(2026, 5, 14, 9, 30)],
    ['second', 'Now', new CalendarDateTime(2026, 5, 14, 9, 30, 45)]
  ])(
    'selects the current %s with its footer button',
    async (granularity, text, date) => {
      wrapper = await openCalendar({ granularity })
      const button = wrapper.find('.dito-calendar__now')
      expect(button.text()).toBe(text)
      await button.trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([[date]])
    }
  )

  it('shows the placeholder only without a value', async () => {
    wrapper = mount(DitoDatePicker, { props: { placeholder: 'From' } })
    const getPlaceholder = () => wrapper.find('.dito-date-picker__placeholder')
    expect(getPlaceholder().text()).toBe('From')
    expect(wrapper.classes()).toContain('dito-date-picker--placeholder')
    await wrapper.setProps({ modelValue: new CalendarDate(2026, 5, 14) })
    expect(getPlaceholder().exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('dito-date-picker--placeholder')
  })

  it('focuses the first part on clicks outside the parts', async () => {
    wrapper = mount(DitoDatePicker, {
      props: { placeholder: 'From' },
      attachTo: document.body
    })
    await wrapper.find('.dito-date-picker__placeholder').trigger('mousedown')
    expect(document.activeElement).toBe(
      wrapper.find('[contenteditable="true"]').element
    )
  })

  it(`doesn't open the calendar of readonly fields`, () => {
    wrapper = mount(DitoDatePicker, { props: { readonly: true } })
    expect(
      wrapper.find('button[aria-label="Choose date"]').attributes('disabled')
    ).toBeDefined()
  })

  it('steps the calendar by years', async () => {
    wrapper = await openCalendar({ modelValue: new CalendarDate(2026, 5, 14) })
    const year = wrapper.find('select[aria-label="Year"]')
    await wrapper.find('button[aria-label="Previous year"]').trigger('click')
    expect(year.element.value).toBe('2025')
    await wrapper.find('button[aria-label="Next year"]').trigger('click')
    await wrapper.find('button[aria-label="Next year"]').trigger('click')
    expect(year.element.value).toBe('2027')
    expect(wrapper.emitted('update:modelValue')).toBe(undefined)
  })
})
