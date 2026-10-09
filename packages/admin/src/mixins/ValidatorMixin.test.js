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
})
