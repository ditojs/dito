import { mount } from '@vue/test-utils'
import DitoSwitch from './DitoSwitch.vue'

function mountSwitch(props = {}, options = {}) {
  return mount(DitoSwitch, { props, attachTo: document.body, ...options })
}

describe('DitoSwitch', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('renders an unchecked checkbox with the switch role', () => {
    wrapper = mountSwitch()
    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('checkbox')
    expect(input.attributes('role')).toBe('switch')
    expect(input.attributes('aria-checked')).toBe('false')
    expect(input.element.checked).toBe(false)
    expect(wrapper.classes()).toEqual(['dito-switch'])
  })

  it('reflects the checked and disabled states', () => {
    wrapper = mountSwitch({ modelValue: true, disabled: true })
    const input = wrapper.find('input')
    expect(input.element.checked).toBe(true)
    expect(input.attributes('aria-checked')).toBe('true')
    expect(input.element.disabled).toBe(true)
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dito-switch--checked', 'dito-switch--disabled'])
    )
  })

  it('emits `update:modelValue` and `change` when toggled', async () => {
    wrapper = mountSwitch({
      'onUpdate:modelValue': modelValue => wrapper.setProps({ modelValue })
    })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.emitted('change')).toEqual([[true]])
    expect(wrapper.classes()).toContain('dito-switch--checked')
    await wrapper.find('input').setValue(false)
    expect(wrapper.emitted('change')).toEqual([[true], [false]])
  })

  it('emits changes only once without a v-model binding', async () => {
    wrapper = mountSwitch()
    await wrapper.find('input').setValue(true)
    // The model value is still false, so unchecking again is no change:
    await wrapper.find('input').setValue(false)
    expect(wrapper.emitted('change')).toEqual([[true]])
  })

  it(`follows the model value without emitting it back`, async () => {
    wrapper = mountSwitch()
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('input').element.checked).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('passes id, name and attributes to the input, the class to the root', () => {
    wrapper = mountSwitch(
      { id: 'is-available', name: 'isAvailable' },
      { attrs: { 'class': 'availability', 'aria-describedby': 'hint' } }
    )
    const input = wrapper.find('input')
    expect(input.attributes()).toMatchObject({
      'id': 'is-available',
      'name': 'isAvailable',
      'aria-describedby': 'hint'
    })
    expect(input.classes()).toEqual([])
    expect(wrapper.classes()).toContain('availability')
  })

  it('renders no label without `labels`', () => {
    wrapper = mountSwitch()
    expect(wrapper.find('.dito-switch__label').exists()).toBe(false)
    expect(wrapper.attributes('style')).toBeUndefined()
  })

  it('renders default labels for `labels: true`', async () => {
    wrapper = mountSwitch({ labels: true })
    expect(wrapper.find('.dito-switch__label').text()).toBe('off')
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('.dito-switch__label').text()).toBe('on')
  })

  it('renders custom labels and sizes the switch to fit them', async () => {
    wrapper = mountSwitch({
      labels: { checked: 'lent', unchecked: 'shelved' }
    })
    expect(wrapper.find('.dito-switch__label').text()).toBe('shelved')
    // The longest label has 7 characters:
    expect(wrapper.element.style.getPropertyValue('--switch-width')).toBe(
      '10.5rem'
    )
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('.dito-switch__label').text()).toBe('lent')
  })

  it('renders the label slots instead of the labels', async () => {
    wrapper = mountSwitch(
      { labels: true },
      {
        slots: {
          checked: '<b>Yes</b>',
          unchecked: '<i>No</i>'
        }
      }
    )
    expect(wrapper.find('.dito-switch__label').html()).toContain('<i>No</i>')
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('.dito-switch__label').html()).toContain('<b>Yes</b>')
  })

  // Bug: `Math.max()` returns NaN when one of the labels is missing, so the
  // width isn't adjusted to the label that is given.
  it.fails('sizes the switch to fit a single custom label', () => {
    wrapper = mountSwitch({ labels: { checked: 'available' } })
    expect(wrapper.element.style.getPropertyValue('--switch-width')).toBe(
      '13.5rem'
    )
  })

  it('focuses the input', () => {
    wrapper = mountSwitch()
    wrapper.vm.focus()
    expect(document.activeElement).toBe(wrapper.find('input').element)
  })
})
