import { mount } from '@vue/test-utils'
import ValidationMixin from './ValidationMixin.js'

function mountValidation() {
  return mount({
    mixins: [ValidationMixin],
    data: () => ({ value: null, label: 'Title' }),
    methods: { scrollIntoView() {} },
    render: () => null
  }).vm
}

describe('ValidationMixin', () => {
  describe('showValidationErrors()', () => {
    it('shows the errors with the label', () => {
      const component = mountValidation()
      expect(component.showValidationErrors([{ message: 'is required' }]))
        .toBe(true)
      expect(component.errors).toEqual(['The Title field is required.'])
      expect(component.hasErrors).toBe(true)
    })

    it('clears the errors when there are none', () => {
      const component = mountValidation()
      component.showValidationErrors([{ message: 'is required' }])
      expect(component.showValidationErrors([])).toBe(false)
      expect(component.errors).toBe(null)
      expect(component.hasErrors).toBe(false)
    })
  })
})
