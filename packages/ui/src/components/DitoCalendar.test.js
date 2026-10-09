import { mount, flushPromises } from '@vue/test-utils'
import DitoCalendar from './DitoCalendar.vue'

function mountCalendar(props = {}) {
  return mount(DitoCalendar, {
    props: { modelValue: new Date(2024, 2, 5, 14, 30), ...props },
    attachTo: document.body
  })
}

function findCell(wrapper, label) {
  return wrapper.find(`[role="gridcell"][aria-label="${label}"]`)
}

function findCursorCell(wrapper) {
  return wrapper.find('[role="gridcell"][tabindex="0"]')
}

function getEmittedDates(wrapper) {
  return (wrapper.emitted('update:modelValue') ?? []).map(([date]) => date)
}

function isSameDay(date, other) {
  return date.toDateString() === other.toDateString()
}

describe('DitoCalendar', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('renders its controls as buttons', () => {
    wrapper = mountCalendar()
    const controls = wrapper.findAll('[aria-label]').filter(
      control =>
        !['dialog', 'grid', 'columnheader'].includes(
          control.attributes('role')
        )
    )
    expect(controls.length).toBeGreaterThan(40)
    for (const control of controls) {
      expect(control.element.tagName).toBe('BUTTON')
      expect(control.attributes('type')).toBe('button')
    }
  })

  it('renders the dates as a grid of weeks with one tab stop', () => {
    wrapper = mountCalendar()
    const rows = wrapper.findAll('[role="grid"] > [role="row"]')
    // The weekdays and six weeks:
    expect(rows).toHaveLength(7)
    expect(rows[0].findAll('[role="columnheader"]')).toHaveLength(7)
    expect(rows[1].findAll('[role="gridcell"]')).toHaveLength(7)
    expect(wrapper.findAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1)
    expect(findCursorCell(wrapper).attributes('aria-label')).toBe(
      'March 5, 2024'
    )
    expect(findCursorCell(wrapper).attributes('aria-selected')).toBe('true')
  })

  it('moves the focus through the grid with the keyboard', async () => {
    wrapper = mountCalendar()
    findCursorCell(wrapper).element.focus()
    const pressKey = async key => {
      await findCursorCell(wrapper).trigger('keydown', { key })
      await flushPromises()
      return document.activeElement.getAttribute('aria-label')
    }
    expect(await pressKey('ArrowRight')).toBe('March 6, 2024')
    expect(await pressKey('ArrowDown')).toBe('March 13, 2024')
    expect(await pressKey('PageDown')).toBe('April 13, 2024')
    expect(await pressKey('End')).toBe('April 30, 2024')
    expect(await pressKey('ArrowRight')).toBe('May 1, 2024')
    // Backwards, the cursor's cell comes before the previous one:
    expect(await pressKey('ArrowLeft')).toBe('April 30, 2024')
    expect(await pressKey('ArrowUp')).toBe('April 23, 2024')
    expect(await pressKey('Home')).toBe('April 1, 2024')
    expect(getEmittedDates(wrapper)).toEqual([])
  })

  it('selects a day without changing the time', async () => {
    wrapper = mountCalendar()
    await findCell(wrapper, 'March 7, 2024').trigger('click')
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 2, 7, 14, 30)])
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('selects a day without a time after the value is cleared', async () => {
    wrapper = mountCalendar()
    await wrapper.setProps({ modelValue: null })
    await findCursorCell(wrapper).trigger('click')
    const [date] = getEmittedDates(wrapper)
    expect(isSameDay(date, new Date())).toBe(true)
    expect(date).toEqual(
      new Date(date.getFullYear(), date.getMonth(), date.getDate())
    )
  })

  it(`doesn't select disabled dates, also not today's`, async () => {
    const now = new Date()
    wrapper = mountCalendar({
      modelValue: now,
      disabledDate: date => isSameDay(date, now)
    })
    const cell = findCursorCell(wrapper)
    expect(cell.attributes('aria-disabled')).toBe('true')
    await cell.trigger('click')
    await wrapper.find('.dito-calendar-select-now').trigger('click')
    expect(getEmittedDates(wrapper)).toEqual([])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it(`doesn't select disabled dates when selecting months`, async () => {
    wrapper = mountCalendar({
      disabledDate: date => date.getMonth() === 3
    })
    await wrapper.find('.dito-calendar-select-month').trigger('click')
    await wrapper.find('[aria-label="April"]').trigger('click')
    await wrapper.find('.dito-calendar-select-month').trigger('click')
    await wrapper.find('[aria-label="May"]').trigger('click')
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 4, 1, 14, 30)])
  })

  it('skips disabled dates when navigating', () => {
    wrapper = mountCalendar({
      disabledDate: date => date.getDate() === 6
    })
    const { vm } = wrapper
    expect(vm.navigate({ step: 1, mode: 'day', update: true })).toBe(true)
    expect(getEmittedDates(wrapper)).toEqual([new Date(2024, 2, 7, 14, 30)])
  })

  it('only moves the cursor when navigating without `update`', async () => {
    wrapper = mountCalendar({
      disabledDate: date => date.getDate() === 6
    })
    expect(wrapper.vm.navigate({ step: 1, mode: 'day' })).toBe(true)
    await flushPromises()
    expect(getEmittedDates(wrapper)).toEqual([])
    expect(findCursorCell(wrapper).attributes('aria-label')).toBe(
      'March 6, 2024'
    )
  })

  it(`doesn't select a disabled date with Enter`, () => {
    wrapper = mountCalendar({
      disabledDate: date => date.getDate() === 5
    })
    wrapper.vm.navigate({ enter: true })
    expect(getEmittedDates(wrapper)).toEqual([])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('moves the focus along when switching modes', async () => {
    wrapper = mountCalendar()
    const button = wrapper.find('.dito-calendar-select-month')
    button.element.focus()
    await button.trigger('click')
    await flushPromises()
    expect(document.activeElement.getAttribute('aria-label')).toBe('March')
    await wrapper.find('[aria-label="June"]').trigger('click')
    await flushPromises()
    expect(document.activeElement.getAttribute('aria-label')).toBe(
      'June 1, 2024'
    )
  })
})
