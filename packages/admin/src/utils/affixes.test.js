import { getInputAffixesProps } from './affixes.js'

function getProps(component) {
  return getInputAffixesProps({
    schema: {},
    disabled: false,
    clearable: false,
    value: null,
    label: null,
    info: null,
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

  it('shows the info in the suffix only without a label', () => {
    expect(getProps({ info: 'Help' })).toMatchObject({
      prefix: { inlineInfo: null },
      suffix: { inlineInfo: 'Help' }
    })
    expect(
      getProps({ info: 'Help', label: 'Title' }).suffix.inlineInfo
    ).toBe(null)
  })
})
