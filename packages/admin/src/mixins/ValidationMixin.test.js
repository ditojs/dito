import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ValidationMixin from './ValidationMixin.js'

const focus = vi.fn()

function mountValidation() {
  focus.mockClear()
  return mount({
    mixins: [ValidationMixin],
    data: () => ({
      value: null,
      label: 'Title',
      validations: { required: true }
    }),
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
  describe('verify()', () => {
    it('checks the value without showing errors', () => {
      const component = mountValidation()
      expect(component.verify()).toBe(false)
      expect(component.errors).toBe(null)
      expect(component.isValidated).toBe(false)
      component.value = 'Emma'
      expect(component.verify()).toBe(true)
    })
  })

  describe('getErrors()', () => {
    it('returns a copy of the errors, or null without errors', () => {
      const component = mountValidation()
      expect(component.getErrors()).toBe(null)
      expect(component.validate()).toBe(false)
      const errors = component.getErrors()
      expect(errors).toEqual(['The Title field is required.'])
      errors.length = 0
      expect(component.errors).toHaveLength(1)
    })
  })

  describe('removeError()', () => {
    it('removes the last occurrence, and resets the errors once empty', () => {
      const component = mountValidation()
      component.addError('Duplicate')
      component.addError('Other')
      component.addError('Duplicate')
      component.removeError('Duplicate')
      expect(component.errors).toEqual(['Duplicate', 'Other'])
      component.removeError('Missing')
      expect(component.errors).toEqual(['Duplicate', 'Other'])
      component.removeError('Duplicate')
      component.removeError('Other')
      expect(component.errors).toBe(null)
      component.removeError('Other')
      expect(component.errors).toBe(null)
    })
  })

  describe('addError()', () => {
    it('labels errors with the placeholder or name without label', () => {
      const component = mount({
        mixins: [ValidationMixin],
        data: () => ({ value: null, name: 'title', placeholder: null }),
        render: () => null
      }).vm
      component.addError('is required', true)
      component.placeholder = 'Book title'
      component.addError('is too short', true)
      expect(component.errors).toEqual([
        'The title field is required.',
        'The Book title field is too short.'
      ])
    })
  })
})
