import { mount } from '@vue/test-utils'
import DitoTimeInput from './DitoTimeInput.vue'

describe('DitoTimeInput', () => {
  it('shows the disabled and error states of `DitoInput`', () => {
    const wrapper = mount(DitoTimeInput, {
      attrs: { 'disabled': '', 'aria-invalid': 'true' }
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dito-input--disabled', 'dito-input--has-errors'])
    )
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false)
  })

  it('focuses its first part', () => {
    const wrapper = mount(DitoTimeInput, { attachTo: document.body })
    wrapper.vm.focus()
    expect(document.activeElement).toBe(
      wrapper.find('[contenteditable="true"]').element
    )
    wrapper.unmount()
  })
})
