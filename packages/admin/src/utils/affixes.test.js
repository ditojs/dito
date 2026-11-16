import { getInputAffixesProps } from './affixes.js'

function getProps(component) {
  return getInputAffixesProps({
    schema: {},
    disabled: false,
    clearable: false,
    value: null,
    context: {},
    ...component
  })
}

describe('getInputAffixesProps()', () => {
  it('returns the items of the prefix and the suffix', () => {
    const context = {}
    const { prefix, suffix } = getProps({
      schema: { prefix: 'From', suffix: ['To'] },
      disabled: true,
      context
    })
    expect(prefix).toMatchObject({
      items: 'From',
      disabled: true,
      parentContext: context
    })
    expect(suffix).toMatchObject({
      items: ['To'],
      disabled: true,
      parentContext: context
    })
  })

  it('makes only the suffix clearable, with whether there is a value', () => {
    expect(getProps({ clearable: true, value: 0 })).toMatchObject({
      prefix: { clearable: false, hasValue: false },
      suffix: { clearable: true, hasValue: true }
    })
    expect(getProps({ clearable: true, value: null }).suffix).toMatchObject({
      clearable: true,
      hasValue: false
    })
    expect(getProps({ clearable: false, value: 'a' }).suffix).toMatchObject({
      clearable: false,
      hasValue: true
    })
  })

  it('tells which affixes have content to show', () => {
    expect(getProps({})).toMatchObject({ hasPrefix: false, hasSuffix: false })
    expect(getProps({ schema: { prefix: '$' } })).toMatchObject({
      hasPrefix: true,
      hasSuffix: false
    })
    expect(getProps({ clearable: true }).hasSuffix).toBe(false)
    expect(getProps({ clearable: true, value: 'a' }).hasSuffix).toBe(true)
  })
})
