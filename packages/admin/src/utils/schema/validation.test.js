import NumberMixin from '../../mixins/NumberMixin.js'
import { registerTypeComponent } from './types.js'
import {
  getValidationRules,
  getValidationMessages,
  validateData
} from './validation.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('password', {
  defaultNested: true,
  getTypeValidationRules: () => ({ password: true })
})
registerTypeComponent('number', { ...NumberMixin, defaultNested: true })
registerTypeComponent('integer', { ...NumberMixin, defaultNested: true })
registerTypeComponent('section', { defaultNested: false })
registerTypeComponent('list', { defaultNested: true })
registerTypeComponent('object', { defaultNested: true })

describe('getValidationRules()', () => {
  it('returns no rules for plain schemas', () => {
    expect(getValidationRules({ type: 'text' })).toEqual({})
  })

  it('supports `required` as value and callback', () => {
    expect(getValidationRules({ type: 'text', required: true })).toEqual({
      required: true
    })
    const schema = { type: 'text', required: ({ value }) => value === 1 }
    expect(getValidationRules(schema, { value: 1 })).toEqual({
      required: true
    })
    expect(getValidationRules(schema, { value: 2 })).toEqual({})
  })

  it('adds the rules of the type', () => {
    expect(getValidationRules({ type: 'password' })).toEqual({
      password: true
    })
  })

  it('applies `schema.rules` overrides', () => {
    expect(
      getValidationRules({
        type: 'password',
        required: true,
        rules: { password: undefined, required: undefined, email: true }
      })
    ).toEqual({ email: true })
  })

  it('ignores unknown types', () => {
    expect(getValidationRules({ type: 'unknown', required: true })).toEqual({
      required: true
    })
  })

  describe('number types', () => {
    it.each([
      [{ type: 'number' }, {}],
      [{ type: 'number', min: 1 }, { min: 1 }],
      [{ type: 'number', max: 2 }, { max: 2 }],
      [{ type: 'number', min: 1, max: 2 }, { range: [1, 2] }],
      [{ type: 'number', range: [1, 2] }, { range: [1, 2] }],
      [{ type: 'number', range: [1, 2], min: 0 }, { range: [0, 2] }],
      [{ type: 'number', decimals: 2 }, { decimals: 2 }],
      [{ type: 'number', step: 0.25 }, { decimals: 2 }],
      [{ type: 'number', step: 5 }, { integer: true }],
      [{ type: 'number', step: 0.5, decimals: 3 }, { decimals: 3 }],
      [{ type: 'integer' }, { integer: true }],
      [
        { type: 'integer', range: [0.5, 1.5], step: 0.5 },
        { range: [0, 2], integer: true }
      ]
    ])('%j', (schema, rules) => {
      expect(getValidationRules(schema)).toEqual(rules)
    })

    it('evaluates callbacks with the context', () => {
      const schema = { type: 'number', max: ({ item }) => item.limit }
      expect(getValidationRules(schema, { item: { limit: 3 } })).toEqual({
        max: 3
      })
    })
  })
})

describe('getValidationMessages()', () => {
  it('returns no messages for valid values', () => {
    const rules = { required: true, range: [0, 2] }
    expect(getValidationMessages(1, rules)).toEqual([])
  })

  it('applies `required` only to empty values', () => {
    expect(getValidationMessages(null, { required: true })).toEqual([
      'is required'
    ])
    expect(getValidationMessages('', { required: true })).toEqual([
      'is required'
    ])
    expect(getValidationMessages(undefined, { required: true })).toEqual([
      'is required'
    ])
    expect(getValidationMessages(0, { required: true })).toEqual([])
  })

  it('applies other rules only to non-empty values', () => {
    expect(getValidationMessages(null, { min: 1, email: true })).toEqual([])
    expect(getValidationMessages('', { min: 1, email: true })).toEqual([])
    expect(getValidationMessages(0, { min: 1 })).toEqual(['must be 1 or more'])
  })

  it('returns all messages, without label prefix', () => {
    expect(getValidationMessages(1.5, { min: 2, integer: true })).toEqual([
      'must be 2 or more',
      'must be whole number'
    ])
    expect(getValidationMessages(5, { range: [1, 2] })).toEqual([
      'must be between 1 and 2'
    ])
  })

  it('passes the other rules to the validators', () => {
    // Unchanged passwords are `undefined` and satisfy `required`:
    const rules = { required: true, password: true }
    expect(getValidationMessages(undefined, rules)).toEqual([])
    expect(getValidationMessages(null, rules)).toEqual(['is required'])
  })

  it('ignores unknown rules', () => {
    expect(getValidationMessages('a', { unknown: true })).toEqual([])
  })
})

describe('validateData()', () => {
  const required = { message: 'is required' }

  it('returns `null` for valid data', () => {
    const schema = {
      components: {
        title: { type: 'text', required: true }
      }
    }
    expect(validateData(schema, { title: 'Title' })).toBe(null)
  })

  it('returns errors by data path, in the format of server errors', () => {
    const schema = {
      components: {
        title: { type: 'text', required: true },
        count: { type: 'integer', min: 1 },
        note: { type: 'text' }
      }
    }
    expect(validateData(schema, { title: '', count: 0.5 })).toEqual({
      title: [required],
      count: [
        { message: 'must be 1 or more' },
        { message: 'must be whole number' }
      ]
    })
  })

  it('prefixes errors with `dataPath`', () => {
    const schema = {
      components: { title: { type: 'text', required: true } }
    }
    expect(validateData(schema, {}, { dataPath: 'items/0' })).toEqual({
      'items/0/title': [required]
    })
  })

  it('validates tabs, panels and unnested components', () => {
    const schema = {
      components: {
        section: {
          type: 'section',
          components: { a: { type: 'text', required: true } }
        }
      },
      tabs: {
        tab: {
          type: 'tab',
          components: { b: { type: 'text', required: true } }
        }
      },
      panels: {
        panel: {
          type: 'panel',
          components: { c: { type: 'text', required: true } }
        }
      }
    }
    expect(validateData(schema, {})).toEqual({
      a: [required],
      b: [required],
      c: [required]
    })
  })

  it('validates the items of nested forms', () => {
    const schema = {
      components: {
        items: {
          type: 'list',
          form: {
            type: 'form',
            components: { title: { type: 'text', required: true } }
          }
        },
        object: {
          type: 'object',
          forms: {
            a: {
              type: 'form',
              components: { a: { type: 'text', required: true } }
            },
            b: {
              type: 'form',
              components: { b: { type: 'text', required: true } }
            }
          }
        }
      }
    }
    const data = {
      items: [{ title: 'Title' }, { title: null }],
      object: { type: 'b' }
    }
    expect(validateData(schema, data)).toEqual({
      'items/1/title': [required],
      'object/b': [required]
    })
  })

  it('skips components whose `if` is false', () => {
    const schema = {
      components: {
        show: { type: 'text' },
        a: {
          type: 'text',
          required: true,
          if: ({ item }) => item.show
        },
        section: {
          type: 'section',
          if: ({ item }) => item.show,
          components: { b: { type: 'text', required: true } }
        },
        items: {
          type: 'list',
          if: ({ item }) => item.show,
          form: {
            type: 'form',
            components: { c: { type: 'text', required: true } }
          }
        }
      },
      tabs: {
        tab: {
          type: 'tab',
          if: ({ item }) => item.show,
          components: { d: { type: 'text', required: true } }
        }
      }
    }
    const data = { items: [{}] }
    expect(validateData(schema, data)).toBe(null)
    expect(validateData(schema, { ...data, show: true })).toEqual({
      'a': [required],
      'b': [required],
      'items/0/c': [required],
      'd': [required]
    })
  })

  it('validates formatted values', () => {
    const schema = {
      components: {
        name: {
          type: 'text',
          required: true,
          format: ({ value }) => value?.trim()
        }
      }
    }
    expect(validateData(schema, { name: '  ' })).toEqual({
      name: [required]
    })
  })

  it('passes `rootData` and `dataPath` to callbacks', () => {
    const rootData = { strict: true }
    const schema = {
      components: {
        name: {
          type: 'text',
          required: ({ rootItem, dataPath }) => (
            rootItem.strict && dataPath === 'item/name'
          )
        }
      }
    }
    expect(
      validateData(schema, {}, { dataPath: 'item', rootData })
    ).toEqual({ 'item/name': [required] })
  })
})
