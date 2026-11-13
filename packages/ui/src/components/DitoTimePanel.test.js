import { vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DitoTimePanel from './DitoTimePanel.vue'

const keyCodes = { ArrowUp: 38, ArrowDown: 40, Enter: 13, ArrowLeft: 37 }

function createKeyEvent(key) {
  return new KeyboardEvent('keydown', {
    key,
    keyCode: keyCodes[key],
    bubbles: true,
    cancelable: true
  })
}

function mountTimePanel(props = {}) {
  return mount(DitoTimePanel, {
    props: { modelValue: new Date(2024, 2, 5, 9, 15, 30), ...props },
    attachTo: document.body
  })
}

function getEmittedTimes(wrapper) {
  return (wrapper.emitted('update:modelValue') ?? []).map(([date]) => [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ])
}

// Fakes the layout of the hour list, with options of 24px and a list that
// shows seven of them.
// Waits for the initial scroll after mounting first.
async function layOutHours(wrapper, scrollTop = 0) {
  await flushPromises()
  const list = wrapper.find('.dito-time-picker-hour').element
  list.scrollTo = vi.fn()
  list.scrollTop = scrollTop
  Object.defineProperty(list, 'clientHeight', { value: 168 })
  for (const [index, option] of wrapper
    .findAll('.dito-time-picker-hour li')
    .entries()) {
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
    const columns = ['hour', 'minute', 'second'].map(name =>
      wrapper.find(`.dito-time-picker-${name}`)
    )
    expect(columns.map(column => column.attributes('aria-label'))).toEqual([
      'Hour',
      'Minute',
      'Second'
    ])
    expect(columns.map(column => column.findAll('li').length)).toEqual([
      24, 60, 60
    ])
    const selected = wrapper.findAll('li.selected')
    expect(selected.map(option => option.text())).toEqual(['09', '15', '30'])
    expect(selected[0].attributes('aria-selected')).toBe('true')
  })

  it('sets the time of the value when picking options', async () => {
    wrapper = mountTimePanel()
    const hours = wrapper.findAll('.dito-time-picker-hour li')
    await hours[17].trigger('click')
    const [[date]] = wrapper.emitted('update:modelValue')
    expect(date).toEqual(new Date(2024, 2, 5, 17, 15, 30))
  })

  it('starts from midnight today without a value', async () => {
    wrapper = mountTimePanel({ modelValue: null })
    await wrapper.findAll('.dito-time-picker-minute li')[45].trigger('click')
    const [[date]] = wrapper.emitted('update:modelValue')
    expect(date.toDateString()).toBe(new Date().toDateString())
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([
      0, 45, 0
    ])
  })

  describe('keyboard', () => {
    // Presses `key` in the list of the column `name`:
    function pressKey(wrapper, name, key) {
      const event = createKeyEvent(key)
      wrapper.find(`.dito-time-picker-${name}`).element.dispatchEvent(event)
      return event
    }

    it('makes the lists focusable, the one of the hours first', () => {
      wrapper = mountTimePanel()
      const lists = wrapper.findAll('[role="listbox"]')
      expect(lists.map(list => list.attributes('tabindex'))).toEqual([
        '0',
        '0',
        '0'
      ])
      expect(lists.map(list => list.attributes('data-autofocus'))).toEqual([
        '',
        undefined,
        undefined
      ])
      const hours = lists[0]
      const selected = hours.find('[aria-selected="true"]')
      expect(hours.attributes('aria-activedescendant')).toBe(
        selected.attributes('id')
      )
    })

    it('steps the value of the focused list', () => {
      wrapper = mountTimePanel()
      expect(pressKey(wrapper, 'minute', 'ArrowDown').defaultPrevented).toBe(
        true
      )
      pressKey(wrapper, 'hour', 'ArrowUp')
      expect(getEmittedTimes(wrapper)).toEqual([
        [9, 16, 30],
        [8, 15, 30]
      ])
    })

    it('wraps around at the ends', () => {
      wrapper = mountTimePanel({ modelValue: new Date(2024, 2, 5, 23, 0, 30) })
      pressKey(wrapper, 'hour', 'ArrowDown')
      pressKey(wrapper, 'minute', 'ArrowUp')
      expect(getEmittedTimes(wrapper)).toEqual([
        [0, 0, 30],
        [23, 59, 30]
      ])
    })

    it('emits `select` with Enter', () => {
      wrapper = mountTimePanel()
      pressKey(wrapper, 'second', 'Enter')
      expect(wrapper.emitted('select')).toHaveLength(1)
    })

    it('ignores other keys', () => {
      wrapper = mountTimePanel()
      expect(pressKey(wrapper, 'hour', 'ArrowLeft').defaultPrevented).toBe(
        false
      )
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })
  })

  describe('scrolling', () => {
    it('scrolls smoothly to nearby options when the value changes', async () => {
      wrapper = mountTimePanel()
      // 09 is centered at 9 * 24 - (168 - 24) / 2 = 144:
      const list = await layOutHours(wrapper, 144)
      await wrapper.setProps({ modelValue: new Date(2024, 2, 5, 11, 15, 30) })
      await flushPromises()
      expect(list.scrollTo).toHaveBeenCalledWith({
        top: 192,
        behavior: 'smooth'
      })
    })

    it('jumps to distant options', async () => {
      wrapper = mountTimePanel()
      const list = await layOutHours(wrapper, 144)
      await wrapper.setProps({ modelValue: new Date(2024, 2, 5, 20, 15, 30) })
      await flushPromises()
      expect(list.scrollTo).toHaveBeenCalledWith({ top: 408, behavior: 'auto' })
    })

    it(`doesn't scroll when the value is set to an equal date`, async () => {
      wrapper = mountTimePanel()
      const list = await layOutHours(wrapper)
      await wrapper.setProps({ modelValue: new Date(2024, 2, 5, 9, 15, 30) })
      await flushPromises()
      expect(list.scrollTo).not.toHaveBeenCalled()
    })
  })
})
