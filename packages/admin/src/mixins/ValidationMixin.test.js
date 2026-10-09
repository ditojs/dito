import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ValidationMixin from './ValidationMixin.js'

const focus = vi.fn()

function mountValidation() {
  focus.mockClear()
  return mount({
    mixins: [ValidationMixin],
    data: () => ({ value: null, label: 'Title' }),
    methods: { focus },
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

    it('focuses the component when asked to', () => {
      const component = mountValidation()
      component.showValidationErrors([{ message: 'is required' }], true)
      expect(focus).toHaveBeenCalledOnce()
    })
  })

  describe('markTouched()', () => {
    it('keeps the displayed errors', () => {
      const component = mountValidation()
      component.showValidationErrors([{ message: 'is required' }])
      component.markTouched()
      expect(component.isTouched).toBe(true)
      expect(component.errors).toEqual(['The Title field is required.'])
    })
  })

  describe('markDirty()', () => {
    it('clears the displayed errors', () => {
      const component = mountValidation()
      component.showValidationErrors([{ message: 'is required' }])
      component.markDirty()
      expect(component.errors).toBe(null)
    })
  })
})
