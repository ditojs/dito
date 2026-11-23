import { flushPromises, mount } from '@vue/test-utils'
import { CalendarDateTime, Time } from '@internationalized/date'
import DitoTimeInput from './DitoTimeInput.vue'

describe('DitoTimeInput', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  function mountTimeInput(options) {
    wrapper = mount(DitoTimeInput, { attachTo: document.body, ...options })
    return wrapper
  }

  const findParts = () => wrapper.findAll('[role="spinbutton"]')
  const findPanel = () => wrapper.find('.dito-time-panel')

  async function focusPart(index) {
    findParts()[index].element.focus()
    await flushPromises()
  }

  it('shows the disabled and error states of `DitoInput`', () => {
    mountTimeInput({
      props: { disabled: true },
      attrs: { 'aria-invalid': 'true' }
    })
    expect(wrapper.find('.dito-input').classes()).toEqual(
      expect.arrayContaining(['dito-input--disabled', 'dito-input--has-errors'])
    )
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false)
  })

  it('focuses its first part', () => {
    mountTimeInput()
    wrapper.vm.focus()
    expect(document.activeElement).toBe(
      wrapper.find('[contenteditable="true"]').element
    )
  })

  it('opens the time panel with its button, and focuses the first part', async () => {
    mountTimeInput({ props: { modelValue: new Time(9, 15) } })
    expect(findPanel().exists()).toBe(false)
    await wrapper.find('button[aria-label="Choose time"]').trigger('click')
    await flushPromises()
    expect(findPanel().exists()).toBe(true)
    expect(document.activeElement).toBe(findParts()[0].element)
  })

  it('opens the time panel when a part is focused, and keeps the focus', async () => {
    mountTimeInput({ props: { modelValue: new Time(9, 15) } })
    await focusPart(1)
    expect(findPanel().exists()).toBe(true)
    expect(document.activeElement).toBe(findParts()[1].element)
    // The focus moves on between the parts without closing the panel:
    await focusPart(0)
    expect(findPanel().exists()).toBe(true)
  })

  it('opens the time panel again when a focused part is clicked', async () => {
    mountTimeInput({ props: { modelValue: new Time(9, 15) } })
    await focusPart(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(findPanel().exists()).toBe(false)
    expect(document.activeElement).toBe(findParts()[0].element)
    await findParts()[0].trigger('click')
    await flushPromises()
    expect(findPanel().exists()).toBe(true)
  })

  it('shows the parts of the time in the panel, and sets picked ones', async () => {
    mountTimeInput({
      props: { modelValue: new Time(9, 15, 30), granularity: 'second' }
    })
    await focusPart(0)
    const columns = findPanel().findAll('[role="listbox"]')
    expect(columns).toHaveLength(3)
    await columns[0].findAll('li')[17].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [new Time(17, 15, 30)]
    ])
  })

  it('focuses the part that was picked in the panel', async () => {
    mountTimeInput({ props: { modelValue: new Time(9, 15) } })
    await focusPart(0)
    await findPanel().findAll('[aria-label="Minute"] li')[45].trigger('click')
    expect(document.activeElement).toBe(findParts()[1].element)
    expect(findPanel().exists()).toBe(true)
  })

  it('starts from `defaultPlaceholder` without a value', async () => {
    mountTimeInput({
      props: { defaultPlaceholder: new CalendarDateTime(2026, 5, 14) }
    })
    await focusPart(0)
    await findPanel().findAll('[aria-label="Minute"] li')[45].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [new CalendarDateTime(2026, 5, 14, 0, 45)]
    ])
  })

  it.each(['readonly', 'disabled'])(
    `doesn't open the time panel of %s fields`,
    async state => {
      mountTimeInput({ props: { [state]: true } })
      expect(
        wrapper.find('button[aria-label="Choose time"]').attributes('disabled')
      ).toBeDefined()
      const part = findParts()[0]
      part.element.focus()
      await part.trigger('click')
      await flushPromises()
      expect(findPanel().exists()).toBe(false)
    }
  )

  it('shows `suffix` after its button', () => {
    mountTimeInput({ slots: { suffix: '<button title="Clear"></button>' } })
    expect(
      wrapper.findAll('button').map(button => button.attributes('title'))
    ).toEqual([undefined, 'Clear'])
  })
})
