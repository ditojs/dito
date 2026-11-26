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

  it('focuses the first part on clicks outside the parts', async () => {
    wrapper = mount(DitoDatePicker, {
      props: { placeholder: 'From' },
      attachTo: document.body
    })
    await wrapper.find('.dito-date-segments__placeholder').trigger('mousedown')
    expect(document.activeElement).toBe(
      wrapper.find('[role="spinbutton"]').element
    )
  })

  it('hides the empty parts only behind `placeholder`', () => {
    // The styles hide the parts that follow the placeholder:
    const selector =
      '.dito-date-segments__placeholder ~ .dito-date-segments__part'
    wrapper = mount(DitoDatePicker)
    expect(wrapper.find('.dito-date-segments__part').exists()).toBe(true)
    expect(wrapper.find(selector).exists()).toBe(false)
    wrapper.unmount()
    wrapper = mount(DitoDatePicker, { props: { placeholder: 'From' } })
    expect(wrapper.find(selector).exists()).toBe(true)
  })

  it('marks the parts that are entered and the ones that are empty', async () => {
    wrapper = mount(DitoDatePicker, { attachTo: document.body })
    const segments = wrapper.find('.dito-date-segments')
    expect(segments.classes()).not.toContain('dito-date-segments--entered')
    const month = wrapper.find('.dito-date-segments__part')
    expect(month.classes()).toContain('dito-date-segments__part--empty')
    expect(
      wrapper.findAll('.dito-date-segments__part--literal').length
    ).toBeGreaterThan(0)
    await month.trigger('keydown', { key: '5' })
    expect(segments.classes()).toContain('dito-date-segments--entered')
    expect(month.classes()).not.toContain('dito-date-segments__part--empty')
  })

  describe('popup', () => {
    // Vue skips events that bubble to listeners attached at their time, which
    // is every listener while the clock stands still:
    beforeEach(() => {
      vi.useRealTimers()
    })

    function mountDatePicker(props, slots) {
      wrapper = mount(DitoDatePicker, {
        props,
        slots,
        attachTo: document.body
      })
      return wrapper
    }

    const findParts = () => wrapper.findAll('[role="spinbutton"]')
    const findPart = name =>
      wrapper.find(`[role="spinbutton"][aria-label^="${name},"]`)

    async function focusPart(name) {
      findPart(name).element.focus()
      await flushPromises()
    }

    it('opens the calendar when a part is focused, and keeps the focus', async () => {
      mountDatePicker({ modelValue: new CalendarDate(2026, 5, 14) })
      expect(wrapper.find('.dito-calendar').exists()).toBe(false)
      await focusPart('month')
      expect(wrapper.find('.dito-calendar').exists()).toBe(true)
      expect(document.activeElement).toBe(findPart('month').element)
      // The focus moves on between the parts without closing the calendar:
      await focusPart('day')
      expect(wrapper.find('.dito-calendar').exists()).toBe(true)
      expect(document.activeElement).toBe(findPart('day').element)
    })

    it('closes the calendar on Escape in a part, and opens it on a click', async () => {
      mountDatePicker({ modelValue: new CalendarDate(2026, 5, 14) })
      await focusPart('month')
      await findPart('month').trigger('keydown', { key: 'Escape' })
      await flushPromises()
      expect(wrapper.find('.dito-calendar').exists()).toBe(false)
      expect(document.activeElement).toBe(findPart('month').element)
      await findPart('month').trigger('click')
      await flushPromises()
      expect(wrapper.find('.dito-calendar').exists()).toBe(true)
    })

    it('shows the calendar for the date and the time panel for the time', async () => {
      mountDatePicker({
        modelValue: new CalendarDateTime(2026, 5, 14, 9, 30),
        granularity: 'minute'
      })
      await focusPart('day')
      expect(wrapper.find('.dito-calendar').exists()).toBe(true)
      expect(wrapper.find('.dito-time-panel').exists()).toBe(false)
      await focusPart('minute')
      expect(wrapper.find('.dito-calendar').exists()).toBe(false)
      expect(
        wrapper
          .findAll('.dito-time-panel [role="listbox"]')
          .map(column => column.attributes('aria-label'))
      ).toEqual(['Hour', 'Minute'])
      await wrapper
        .findAll('.dito-time-panel [aria-label="Hour"] li')[17]
        .trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([
        [new CalendarDateTime(2026, 5, 14, 17, 30)]
      ])
      // The button shows the calendar again:
      const button = wrapper.find('button[aria-label="Choose date"]')
      await button.trigger('click')
      await button.trigger('click')
      await flushPromises()
      expect(wrapper.find('.dito-calendar').exists()).toBe(true)
    })

    it('keeps the calendar open when a part is edited by keyboard', async () => {
      mountDatePicker({
        'modelValue': new CalendarDate(2026, 5, 14),
        'onUpdate:modelValue': modelValue => wrapper.setProps({ modelValue })
      })
      await focusPart('month')
      await findPart('month').trigger('keydown', { key: 'ArrowUp' })
      await flushPromises()
      expect(wrapper.props('modelValue')).toEqual(new CalendarDate(2026, 6, 14))
      expect(wrapper.find('.dito-calendar').exists()).toBe(true)
    })

    it('closes the calendar when a day is picked, also the selected one', async () => {
      mountDatePicker({
        'modelValue': new CalendarDate(2026, 5, 14),
        'onUpdate:modelValue': modelValue => wrapper.setProps({ modelValue })
      })
      for (const day of ['2026-05-20', '2026-05-20']) {
        await focusPart('month')
        expect(wrapper.find('.dito-calendar').exists()).toBe(true)
        await wrapper.find(`[data-value="${day}"]`).trigger('click')
        await flushPromises()
        expect(wrapper.find('.dito-calendar').exists()).toBe(false)
        expect(wrapper.props('modelValue')).toEqual(
          new CalendarDate(2026, 5, 20)
        )
        findPart('month').element.blur()
      }
    })

    it('moves the selection along while dragging over the days', async () => {
      mountDatePicker({
        'modelValue': new CalendarDateTime(2026, 5, 14, 9, 30),
        'granularity': 'minute',
        'onUpdate:modelValue': modelValue => wrapper.setProps({ modelValue })
      })
      await focusPart('day')
      const findDay = day => wrapper.find(`[data-value^="2026-05-${day}"]`)
      await findDay(20).trigger('mousedown', { button: 0 })
      expect(wrapper.props('modelValue')).toEqual(
        new CalendarDateTime(2026, 5, 20, 9, 30)
      )
      // The pointer only selects days while its button is pressed:
      await findDay(21).trigger('mouseenter', { buttons: 0 })
      expect(wrapper.props('modelValue').day).toBe(20)
      await findDay(22).trigger('mouseenter', { buttons: 1 })
      expect(findDay(22).attributes('data-selected')).toBeDefined()
      expect(wrapper.find('.dito-calendar').exists()).toBe(true)
      await findDay(22).trigger('mouseup', { button: 0 })
      await flushPromises()
      expect(wrapper.find('.dito-calendar').exists()).toBe(false)
      expect(wrapper.props('modelValue')).toEqual(
        new CalendarDateTime(2026, 5, 22, 9, 30)
      )
    })

    it('shows the start of its parts again once the focus leaves', async () => {
      mountDatePicker({ modelValue: new CalendarDate(2026, 5, 14) })
      const segments = wrapper.find('.dito-date-segments').element
      await focusPart('year')
      segments.scrollLeft = 40
      // The focus moving on between the parts keeps the position:
      await focusPart('day')
      expect(segments.scrollLeft).toBe(40)
      document.activeElement.blur()
      expect(segments.scrollLeft).toBe(0)
    })

    it('focuses the part that was picked in the time panel', async () => {
      mountDatePicker({
        modelValue: new CalendarDateTime(2026, 5, 14, 9, 30),
        granularity: 'minute'
      })
      await focusPart('hour')
      await wrapper
        .findAll('.dito-time-panel [aria-label="Minute"] li')[45]
        .trigger('click')
      await flushPromises()
      expect(document.activeElement).toBe(findPart('minute').element)
      expect(wrapper.find('.dito-time-panel').exists()).toBe(true)
    })

    it('keeps the time panel open at the first pick without a value', async () => {
      mountDatePicker({
        'granularity': 'minute',
        'onUpdate:modelValue': modelValue => wrapper.setProps({ modelValue })
      })
      await focusPart('hour')
      await wrapper
        .findAll('.dito-time-panel [aria-label="Hour"] li')[9]
        .trigger('click')
      await flushPromises()
      expect(wrapper.props('modelValue').hour).toBe(9)
      expect(wrapper.find('.dito-time-panel').exists()).toBe(true)
    })

    it.each(['readonly', 'disabled'])(
      `doesn't open the calendar of %s fields`,
      async state => {
        mountDatePicker({
          modelValue: new CalendarDate(2026, 5, 14),
          [state]: true
        })
        expect(
          wrapper
            .find('button[aria-label="Choose date"]')
            .attributes('disabled')
        ).toBeDefined()
        const part = findParts()[0]
        part.element.focus()
        await part.trigger('click')
        await flushPromises()
        expect(wrapper.find('.dito-calendar').exists()).toBe(false)
      }
    )

    it('shows `suffix` after its button', () => {
      mountDatePicker({}, { suffix: '<button title="Clear"></button>' })
      expect(
        wrapper.findAll('button').map(button => button.attributes('title'))
      ).toEqual([undefined, 'Clear'])
    })
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
