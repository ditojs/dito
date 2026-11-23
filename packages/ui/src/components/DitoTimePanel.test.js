import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { CalendarDateTime, Time } from '@internationalized/date'
import DitoTimePanel from './DitoTimePanel.vue'

function mountTimePanel(props = {}) {
  return mount(DitoTimePanel, {
    props: {
      modelValue: new CalendarDateTime(2024, 3, 5, 9, 15, 30),
      granularity: 'second',
      ...props
    },
    attachTo: document.body
  })
}

// Fakes the layout of the hour list, with options of 24px and a list that
// shows seven of them.
// Waits for the initial scroll after mounting first.
async function layOutHours(wrapper, scrollTop = 0) {
  await flushPromises()
  const column = wrapper.find('[aria-label="Hour"]')
  const list = column.element
  list.scrollTo = vi.fn()
  list.scrollTop = scrollTop
  Object.defineProperty(list, 'clientHeight', { value: 168 })
  for (const [index, option] of column.findAll('li').entries()) {
    Object.defineProperty(option.element, 'offsetTop', { value: index * 24 })
    Object.defineProperty(option.element, 'offsetHeight', { value: 24 })
  }
  return list
}

describe('DitoTimePanel', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('renders padded options and marks the selected ones', () => {
    wrapper = mountTimePanel()
    const columns = wrapper.findAll('[role="listbox"]')
    expect(columns.map(column => column.attributes('aria-label'))).toEqual([
      'Hour',
      'Minute',
      'Second'
    ])
    expect(columns.map(column => column.findAll('li').length)).toEqual([
      24, 60, 60
    ])
    const selected = wrapper.findAll('.dito-time-panel__option--selected')
    expect(selected.map(option => option.text())).toEqual(['09', '15', '30'])
    expect(selected[0].attributes('aria-selected')).toBe('true')
  })

  it.each([
    ['hour', ['Hour']],
    ['minute', ['Hour', 'Minute']],
    ['second', ['Hour', 'Minute', 'Second']]
  ])('shows the parts of the time down to the %s', (granularity, labels) => {
    wrapper = mountTimePanel({ granularity })
    expect(
      wrapper
        .findAll('[role="listbox"]')
        .map(column => column.attributes('aria-label'))
    ).toEqual(labels)
  })

  it('sets the time of dates when picking options, and keeps their day', async () => {
    wrapper = mountTimePanel()
    await wrapper.findAll('[aria-label="Hour"] li')[17].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [new CalendarDateTime(2024, 3, 5, 17, 15, 30)]
    ])
  })

  it('sets the parts of times', async () => {
    wrapper = mountTimePanel({ modelValue: new Time(9, 15) })
    await wrapper.findAll('[aria-label="Minute"] li')[45].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[new Time(9, 45)]])
  })

  it('tells which part was picked', async () => {
    wrapper = mountTimePanel()
    await wrapper.findAll('[aria-label="Minute"] li')[45].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['minute']])
  })

  it('keeps the focus where it is when clicked', () => {
    wrapper = mountTimePanel()
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true
    })
    wrapper.find('li').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  describe('scrolling', () => {
    it('scrolls smoothly to nearby options when the value changes', async () => {
      wrapper = mountTimePanel()
      // 09 is centered at 9 * 24 - (168 - 24) / 2 = 144:
      const list = await layOutHours(wrapper, 144)
      await wrapper.setProps({
        modelValue: new CalendarDateTime(2024, 3, 5, 11, 15, 30)
      })
      await flushPromises()
      expect(list.scrollTo).toHaveBeenCalledWith({
        top: 192,
        behavior: 'smooth'
      })
    })

    it('jumps to distant options', async () => {
      wrapper = mountTimePanel()
      const list = await layOutHours(wrapper, 144)
      await wrapper.setProps({
        modelValue: new CalendarDateTime(2024, 3, 5, 20, 15, 30)
      })
      await flushPromises()
      expect(list.scrollTo).toHaveBeenCalledWith({ top: 408, behavior: 'auto' })
    })

    it(`doesn't scroll when the value is set to an equal date`, async () => {
      wrapper = mountTimePanel()
      const list = await layOutHours(wrapper)
      await wrapper.setProps({
        modelValue: new CalendarDateTime(2024, 3, 5, 9, 15, 30)
      })
      await flushPromises()
      expect(list.scrollTo).not.toHaveBeenCalled()
    })
  })
})
