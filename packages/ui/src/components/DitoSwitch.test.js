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

  it('passes the class to the root, `v-model` and attributes to the switch', async () => {
    const values = []
    wrapper = mountSwitch(
      {
        'modelValue': false,
        'onUpdate:modelValue': modelValue => {
          values.push(modelValue)
          wrapper.setProps({ modelValue })
        }
      },
      { attrs: { id: 'is-available', class: 'availability' } }
    )
    const control = wrapper.find('[role="switch"]')
    expect(wrapper.classes()).toEqual(['dito-switch', 'availability'])
    expect(control.attributes()).toMatchObject({
      'id': 'is-available',
      'data-state': 'unchecked'
    })
    await control.trigger('click')
    expect(values).toEqual([true])
    expect(control.attributes('data-state')).toBe('checked')
  })

  it('renders no label without `labels`', () => {
    wrapper = mountSwitch()
    expect(wrapper.find('.dito-switch__label').exists()).toBe(false)
    expect(wrapper.attributes('style')).toBeUndefined()
  })

  it('renders default labels for `labels: true`', async () => {
    wrapper = mountSwitch({ labels: true })
    expect(wrapper.find('.dito-switch__label').text()).toBe('off')
    await wrapper.find('[role="switch"]').trigger('click')
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
    await wrapper.find('[role="switch"]').trigger('click')
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
    await wrapper.find('[role="switch"]').trigger('click')
    expect(wrapper.find('.dito-switch__label').html()).toContain('<b>Yes</b>')
  })

  it('focuses the switch', () => {
    wrapper = mountSwitch()
    wrapper.vm.focus()
    expect(document.activeElement).toBe(
      wrapper.find('[role="switch"]').element
    )
  })
})
