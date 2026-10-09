import { mountForm } from '../test/mount.js'
import ValidatorMixin from './ValidatorMixin.js'

describe('ValidatorMixin', () => {
  const { isValid, isValidated } = ValidatorMixin.computed

  it('is validated only when all schema components are validated', () => {
    const schemaComponents = [
      { isValidated: true, isValid: true },
      { isValidated: false, isValid: true }
    ]
    expect(isValid.call({ schemaComponents })).toBe(true)
    expect(isValidated.call({ schemaComponents })).toBe(false)
  })

  it('is validated when invalid schema components were validated', () => {
    const schemaComponents = [{ isValidated: true, isValid: false }]
    expect(isValid.call({ schemaComponents })).toBe(false)
    expect(isValidated.call({ schemaComponents })).toBe(true)
  })

  it('shows validation errors on all schema components, first only once', async () => {
    const { showValidationErrors } = ValidatorMixin.methods
    const calls = []
    const createSchemaComponent = shows => ({
      showValidationErrors: async (errors, focus, first) => {
        calls.push(first)
        return shows
      }
    })
    const errors = { title: [{ message: 'is required' }] }
    const schemaComponents = [
      createSchemaComponent(false),
      createSchemaComponent(true),
      createSchemaComponent(true)
    ]
    expect(await showValidationErrors.call({ schemaComponents }, errors, true))
      .toBe(true)
    // Only the components before the first that showed errors are first:
    expect(calls).toEqual([true, true, false])
    expect(
      await showValidationErrors.call(
        { schemaComponents: [createSchemaComponent(false)] },
        errors,
        true
      )
    ).toBe(false)
  })
  describe('in forms', () => {
    const mountBookForm = () =>
      mountForm({
        schema: {
          components: {
            title: { type: 'text', required: true },
            author: { type: 'text', required: true }
          }
        },
        data: { title: null, author: 'Jane Austen' }
      })

    it('verifies all components without showing errors', async () => {
      const { routeComponent, getErrors, data } = await mountBookForm()
      expect(routeComponent.verifyAll()).toBe(false)
      expect(getErrors('title')).toEqual([])
      data.title = 'Emma'
      expect(routeComponent.verifyAll()).toBe(true)
    })

    it('clears the errors of all components', async () => {
      const { routeComponent, getErrors, settle } = await mountBookForm()
      expect(routeComponent.validateAll()).toBe(false)
      await settle()
      expect(getErrors('title')).toEqual(['The Title field is required.'])
      routeComponent.clearErrors()
      await settle()
      expect(getErrors('title')).toEqual([])
    })
  })
})
