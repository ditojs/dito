import { mount, flushPromises } from '@vue/test-utils'
import DitoCalendar from './DitoCalendar.vue'

function mountCalendar(props = {}) {
  return mount(DitoCalendar, {
    props: { modelValue: new Date(2024, 2, 5, 14, 30), ...props },
    attachTo: document.body
  })
}

function getEmittedDates(wrapper) {
  return (wrapper.emitted('update:modelValue') ?? []).map(([date]) => date)
}

function getHeaderText(wrapper) {
  return wrapper.find('.dito-calendar-header span').text()
}

function getCursorLabel(wrapper) {
  return wrapper
    .find('[role="gridcell"][tabindex="0"]')
    .attributes('aria-label')
}

async function click(wrapper, selector) {
  await wrapper.find(selector).trigger('click')
}

describe('DitoCalendar header', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('shows the year and month of the value', () => {
    wrapper = mountCalendar()
    expect(wrapper.find('.dito-calendar-select-year').text()).toBe('2024')
    expect(wrapper.find('.dito-calendar-select-month').text()).toBe('March')
    expect(wrapper.find('[role="grid"]').attributes('aria-label')).toBe(
      'March 2024'
    )
  })

  it('steps months and years without selecting dates', async () => {
    wrapper = mountCalendar()
    await click(wrapper, '.dito-calendar-step-next.dito-calendar-step-month')
    expect(getCursorLabel(wrapper)).toBe('April 5, 2024')
    await click(wrapper, '.dito-calendar-step-next.dito-calendar-step-year')
    expect(getCursorLabel(wrapper)).toBe('April 5, 2025')
    await click(wrapper, '.dito-calendar-step-prev.dito-calendar-step-year')
    await click(wrapper, '.dito-calendar-step-prev.dito-calendar-step-month')
    await click(wrapper, '.dito-calendar-step-prev.dito-calendar-step-month')
    expect(getCursorLabel(wrapper)).toBe('February 5, 2024')
    expect(getEmittedDates(wrapper)).toEqual([])
  })

  it('clamps the day when stepping into shorter months', async () => {
    wrapper = mountCalendar({ modelValue: new Date(2024, 0, 31) })
    await click(wrapper, '.dito-calendar-step-next.dito-calendar-step-month')
    expect(getCursorLabel(wrapper)).toBe('February 29, 2024')
  })

  it('wraps months across year boundaries', async () => {
    wrapper = mountCalendar({ modelValue: new Date(2024, 11, 15) })
    await click(wrapper, '.dito-calendar-step-next.dito-calendar-step-month')
    expect(getCursorLabel(wrapper)).toBe('January 15, 2025')
    await click(wrapper, '.dito-calendar-step-prev.dito-calendar-step-month')
    await click(wrapper, '.dito-calendar-step-prev.dito-calendar-step-month')
    expect(getCursorLabel(wrapper)).toBe('November 15, 2024')
  })

  // Bug: unlike `stepMonth()`, `stepYear()` doesn't clamp the day, so stepping
  // from a leap day overflows into March.
  it.fails('clamps the leap day when stepping years', async () => {
    wrapper = mountCalendar({ modelValue: new Date(2024, 1, 29) })
    await click(wrapper, '.dito-calendar-step-next.dito-calendar-step-year')
    expect(getCursorLabel(wrapper)).toBe('February 28, 2025')
  })
})

describe('DitoCalendar days', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('starts the weeks on Sunday with localized weekday names', () => {
    wrapper = mountCalendar()
    const weekdays = wrapper.findAll('[role="columnheader"]')
    expect(weekdays.map(weekday => weekday.text())).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat'
    ])
    expect(weekdays[0].attributes('aria-label')).toBe('Sunday')
    // March 1, 2024 is a Friday, so the grid starts on February 25:
    expect(
      wrapper.find('[role="gridcell"]').attributes('aria-label')
    ).toBe('February 25, 2024')
  })

  it('renders localized names for other locales', () => {
    wrapper = mountCalendar({ locale: 'de-DE' })
    expect(wrapper.find('.dito-calendar-select-month').text()).toBe('März')
    expect(wrapper.find('[role="columnheader"]').text()).toBe('So')
  })

  it('marks days outside the month as gray or disabled', () => {
    wrapper = mountCalendar({
      disabledDate: date => date.getDate() === 26 || date.getDate() === 12
    })
    const getClasses = label =>
      wrapper.find(`[aria-label="${label}"]`).classes()
    expect(getClasses('February 25, 2024')).toContain('dito-calendar-item-gray')
    expect(getClasses('February 26, 2024')).toContain(
      'dito-calendar-item-disabled'
    )
    expect(getClasses('March 12, 2024')).toContain(
      'dito-calendar-item-disabled'
    )
    expect(getClasses('March 5, 2024')).toContain('dito-calendar-item-active')
    expect(getClasses('March 6, 2024')).toEqual(['dito-calendar__item'])
  })

  it('marks the cursor as current when it differs from the value', async () => {
    wrapper = mountCalendar()
    await click(wrapper, '.dito-calendar-step-next.dito-calendar-step-month')
    const cursor = wrapper.find('[aria-label="April 5, 2024"]')
    expect(cursor.classes()).toContain('dito-calendar-item-current')
    expect(cursor.attributes('aria-selected')).toBe('false')
  })

  it('marks today', () => {
    const now = new Date()
    wrapper = mountCalendar({ modelValue: null })
    const today = wrapper.find('[role="gridcell"][tabindex="0"]')
    expect(today.text()).toBe(String(now.getDate()))
    expect(today.classes()).toContain('dito-calendar-item-today')
  })

  it('starts on today without time when there is no value', () => {
    wrapper = mountCalendar({ modelValue: null })
    const { currentValue } = wrapper.vm
    expect(currentValue.toDateString()).toBe(new Date().toDateString())
    expect(
      [
        currentValue.getHours(),
        currentValue.getMinutes(),
        currentValue.getSeconds(),
        currentValue.getMilliseconds()
      ]
    ).toEqual([0, 0, 0, 0])
  })

  it('selects today with the footer button', async () => {
    wrapper = mountCalendar()
    await click(wrapper, '.dito-calendar-select-now')
    const [date] = getEmittedDates(wrapper)
    expect(date.toDateString()).toBe(new Date().toDateString())
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('follows changes of the model value', async () => {
    wrapper = mountCalendar()
    await wrapper.setProps({ modelValue: new Date(2023, 6, 20) })
    expect(getCursorLabel(wrapper)).toBe('July 20, 2023')
    await wrapper.setProps({ modelValue: null })
    expect(getCursorLabel(wrapper)).toBe(
      new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    )
  })

  it('steps years with Shift+PageUp and Shift+PageDown', async () => {
    wrapper = mountCalendar()
    const grid = wrapper.find('[role="grid"]')
    await grid.trigger('keydown', { key: 'PageDown', shiftKey: true })
    expect(getCursorLabel(wrapper)).toBe('March 5, 2025')
    await grid.trigger('keydown', { key: 'PageUp', shiftKey: true })
    await grid.trigger('keydown', { key: 'PageUp' })
    expect(getCursorLabel(wrapper)).toBe('February 5, 2024')
  })

  it('ignores other keys in the grid', async () => {
    wrapper = mountCalendar()
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true
    })
    wrapper.find('[role="grid"]').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(getCursorLabel(wrapper)).toBe('March 5, 2024')
  })

  it(`doesn't move the focus with keys when the grid isn't focused`, async () => {
    wrapper = mountCalendar()
    await wrapper
      .find('[role="grid"]')
      .trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(getCursorLabel(wrapper)).toBe('March 6, 2024')
    expect(document.activeElement).toBe(document.body)
  })
})

describe('DitoCalendar month mode', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('lists the months with the active and current one marked', async () => {
    wrapper = mountCalendar({ mode: 'month' })
    const months = wrapper.findAll('.dito-calendar-months button')
    expect(months.map(month => month.text())).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ])
    expect(months[2].classes()).toEqual(
      expect.arrayContaining([
        'dito-calendar-item-active',
        'dito-calendar-item-current'
      ])
    )
    expect(months[2].attributes('aria-pressed')).toBe('true')
    expect(months[3].attributes('aria-pressed')).toBe('false')
  })

  it('only marks the active month in the year of the value', async () => {
    wrapper = mountCalendar({ mode: 'month' })
    await click(wrapper, '.dito-calendar-step-next')
    expect(getHeaderText(wrapper)).toBe('2025')
    const march = wrapper.find('[aria-label="March"]')
    expect(march.classes()).toEqual([
      'dito-calendar__item',
      'dito-calendar-item-current'
    ])
    await click(wrapper, '.dito-calendar-step-prev')
    await click(wrapper, '.dito-calendar-step-prev')
    expect(getHeaderText(wrapper)).toBe('2023')
  })

  it('marks no active month without a value', () => {
    wrapper = mountCalendar({ mode: 'month', modelValue: null })
    expect(
      wrapper.findAll('[aria-pressed="true"]')
    ).toHaveLength(0)
  })

  it('switches to the year mode from the header', async () => {
    wrapper = mountCalendar({ mode: 'month' })
    await click(wrapper, '.dito-calendar-select-year')
    expect(getHeaderText(wrapper)).toBe('2020 – 2029')
  })

  it('selects the first of the month and switches to the day mode', async () => {
    wrapper = mountCalendar({ mode: 'month' })
    await wrapper.find('[aria-label="August"]').trigger('click')
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 7, 1, 14, 30)])
    expect(getCursorLabel(wrapper)).toBe('August 1, 2024')
    // Selecting a month only changes the value, it doesn't close pickers:
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('follows changes of the mode prop', async () => {
    wrapper = mountCalendar()
    await wrapper.setProps({ mode: 'month' })
    expect(wrapper.find('.dito-calendar-months').exists()).toBe(true)
    await wrapper.setProps({ mode: 'year' })
    expect(wrapper.find('.dito-calendar-years').exists()).toBe(true)
  })
})

describe('DitoCalendar year mode', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('lists the years of the decade', () => {
    wrapper = mountCalendar({ mode: 'year' })
    expect(getHeaderText(wrapper)).toBe('2020 – 2029')
    const years = wrapper.findAll('.dito-calendar-years button')
    expect(years.map(year => year.text())).toEqual([
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
      '2027',
      '2028',
      '2029'
    ])
    expect(years[4].classes()).toEqual(
      expect.arrayContaining([
        'dito-calendar-item-active',
        'dito-calendar-item-current'
      ])
    )
    expect(years[4].attributes('aria-pressed')).toBe('true')
  })

  it('steps decades', async () => {
    wrapper = mountCalendar({ mode: 'year' })
    await click(wrapper, '.dito-calendar-step-next')
    expect(getHeaderText(wrapper)).toBe('2030 – 2039')
    const current = wrapper.find('.dito-calendar-item-current')
    expect(current.text()).toBe('2034')
    expect(wrapper.find('.dito-calendar-item-active').exists()).toBe(false)
    await click(wrapper, '.dito-calendar-step-prev')
    await click(wrapper, '.dito-calendar-step-prev')
    expect(getHeaderText(wrapper)).toBe('2010 – 2019')
    expect(getEmittedDates(wrapper)).toEqual([])
  })

  it('handles the first decade of a century', () => {
    wrapper = mountCalendar({ mode: 'year', modelValue: new Date(2003, 0, 1) })
    expect(getHeaderText(wrapper)).toBe('2000 – 2009')
  })

  it('selects a year and switches to the month mode', async () => {
    wrapper = mountCalendar({ mode: 'year' })
    await wrapper.find('[aria-label="2027"]').trigger('click')
    expect(getEmittedDates(wrapper)).toEqual([new Date(2027, 2, 5, 14, 30)])
    expect(getHeaderText(wrapper)).toBe('2027')
    expect(wrapper.find('.dito-calendar-months').exists()).toBe(true)
  })

  it(`doesn't select disabled years`, async () => {
    wrapper = mountCalendar({
      mode: 'year',
      disabledDate: date => date.getFullYear() === 2027
    })
    await wrapper.find('[aria-label="2027"]').trigger('click')
    expect(getEmittedDates(wrapper)).toEqual([])
  })

  it('moves the focus to the current year when switching modes', async () => {
    wrapper = mountCalendar()
    const button = wrapper.find('.dito-calendar-select-year')
    button.element.focus()
    await button.trigger('click')
    await flushPromises()
    expect(document.activeElement.getAttribute('aria-label')).toBe('2024')
  })
})

describe('DitoCalendar navigate()', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('moves the cursor by the part given in `mode`', () => {
    wrapper = mountCalendar()
    const { vm } = wrapper
    expect(vm.navigate({ step: 1, mode: 'month' })).toBe(true)
    expect(vm.navigate({ step: -1, mode: 'year' })).toBe(true)
    expect(vm.navigate({ step: 1 })).toBe(true)
    expect(vm.currentValue).toEqual(new Date(2023, 3, 6, 14, 30))
    expect(getEmittedDates(wrapper)).toEqual([])
  })

  it('rejects steps of parts that are not dates', () => {
    wrapper = mountCalendar()
    expect(wrapper.vm.navigate({ step: 1, mode: 'hour' })).toBe(false)
    expect(wrapper.vm.currentValue).toEqual(new Date(2024, 2, 5, 14, 30))
  })

  it('selects stepped dates with `update`', () => {
    wrapper = mountCalendar()
    wrapper.vm.navigate({ step: -1, mode: 'month', update: true })
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 1, 5, 14, 30)])
  })

  it('gives up after a year of disabled dates', () => {
    wrapper = mountCalendar({ disabledDate: () => true })
    expect(wrapper.vm.navigate({ step: 1, mode: 'day', update: true })).toBe(
      false
    )
    expect(getEmittedDates(wrapper)).toEqual([])
  })

  it('switches modes back with Enter', () => {
    wrapper = mountCalendar({ mode: 'year' })
    expect(wrapper.vm.navigate({ enter: true })).toBe(true)
    expect(wrapper.vm.currentMode).toBe('month')
    wrapper.vm.navigate({ enter: true })
    expect(wrapper.vm.currentMode).toBe('day')
    wrapper.vm.navigate({ enter: true })
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 2, 5, 14, 30)])
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('returns false without step or enter', () => {
    wrapper = mountCalendar()
    expect(wrapper.vm.navigate({})).toBe(false)
  })

  // Bug: stepping the month part uses `alterDate()` without clamping the day,
  // so from January 31 it overflows past February into March.
  it.fails('clamps the day when stepping the month part', () => {
    wrapper = mountCalendar({ modelValue: new Date(2024, 0, 31) })
    wrapper.vm.navigate({ step: 1, mode: 'month', update: true })
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 1, 29)])
  })
})

describe('DitoCalendar handleKey()', () => {
  const keyCodes = { ArrowUp: 38, ArrowDown: 40, Enter: 13, ArrowLeft: 37 }

  function createKeyEvent(key) {
    return new KeyboardEvent('keydown', { key, keyCode: keyCodes[key] })
  }

  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('steps the date part at the caret with the arrow keys', () => {
    wrapper = mountCalendar()
    expect(
      wrapper.vm.handleKey(createKeyEvent('ArrowDown'), { name: 'day' })
    ).toBe(true)
    expect(
      wrapper.vm.handleKey(createKeyEvent('ArrowUp'), { name: 'year' })
    ).toBe(true)
    expect(getEmittedDates(wrapper)).toEqual([
      new Date(2024, 2, 6, 14, 30),
      new Date(2023, 2, 6, 14, 30)
    ])
  })

  it(`doesn't step without a date part at the caret`, () => {
    wrapper = mountCalendar()
    expect(wrapper.vm.handleKey(createKeyEvent('ArrowDown'), null)).toBe(false)
    expect(
      wrapper.vm.handleKey(createKeyEvent('ArrowDown'), { name: 'hour' })
    ).toBe(false)
    expect(getEmittedDates(wrapper)).toEqual([])
  })

  it('selects the cursor with Enter', () => {
    wrapper = mountCalendar()
    expect(wrapper.vm.handleKey(createKeyEvent('Enter'), null)).toBe(true)
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('ignores horizontal arrow keys', () => {
    wrapper = mountCalendar()
    expect(
      wrapper.vm.handleKey(createKeyEvent('ArrowLeft'), { name: 'day' })
    ).toBe(false)
  })
})
