import NumberMixin from '../../mixins/NumberMixin.js'
import { registerTypeComponent } from './types.js'
import {
  getValidations,
  getValueValidationErrors,
  getDataValidationErrors,
  getMatchingValidationErrors
} from './validation.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('password', {
  defaultNested: true,
  getTypeValidations: () => ({ password: true })
})
registerTypeComponent('number', { ...NumberMixin, defaultNested: true })
registerTypeComponent('integer', { ...NumberMixin, defaultNested: true })
registerTypeComponent('section', { defaultNested: false })
registerTypeComponent('list', {
  defaultNested: true,
  getSourceType: () => 'list'
})
registerTypeComponent('object', {
  defaultNested: true,
  getSourceType: () => 'object'
})

describe('getValidations()', () => {
  it('returns no validations for plain schemas', () => {
    expect(getValidations({ type: 'text' })).toEqual({})
  })

  it('supports `required` as value and callback', () => {
    expect(getValidations({ type: 'text', required: true })).toEqual({
      required: true
    })
    const schema = { type: 'text', required: ({ value }) => value === 1 }
    expect(getValidations(schema, { value: 1 })).toEqual({
      required: true
    })
    expect(getValidations(schema, { value: 2 })).toEqual({})
  })

  it('adds the validations of the type', () => {
    expect(getValidations({ type: 'password' })).toEqual({
      password: true
    })
  })

  it('applies `schema.rules` overrides', () => {
    expect(
      getValidations({
        type: 'password',
        required: true,
        rules: { password: undefined, required: undefined, email: true }
      })
    ).toEqual({ email: true })
  })

  it('ignores unknown types', () => {
    expect(getValidations({ type: 'unknown', required: true })).toEqual({
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
    ])('%j', (schema, validations) => {
      expect(getValidations(schema)).toEqual(validations)
    })

    it('evaluates callbacks with the context', () => {
      const schema = { type: 'number', max: ({ item }) => item.limit }
      expect(getValidations(schema, { item: { limit: 3 } })).toEqual({
        max: 3
      })
    })
  })
})

describe('getValueValidationErrors()', () => {
  it('returns no errors for valid values', () => {
    const validations = { required: true, range: [0, 2] }
    expect(getValueValidationErrors(1, validations)).toEqual([])
  })

  it('applies `required` only to empty values', () => {
    expect(getValueValidationErrors(null, { required: true })).toEqual([
      { message: 'is required' }
    ])
    expect(getValueValidationErrors('', { required: true })).toEqual([
      { message: 'is required' }
    ])
    expect(getValueValidationErrors(undefined, { required: true })).toEqual([
      { message: 'is required' }
    ])
    expect(getValueValidationErrors(0, { required: true })).toEqual([])
  })

  it('applies other validations only to non-empty values', () => {
    expect(getValueValidationErrors(null, { min: 1, email: true })).toEqual([])
    expect(getValueValidationErrors('', { min: 1, email: true })).toEqual([])
    expect(getValueValidationErrors(0, { min: 1 })).toEqual([
      { message: 'must be 1 or more' }
    ])
  })

  it('returns all errors, with messages without label prefix', () => {
    expect(getValueValidationErrors(1.5, { min: 2, integer: true })).toEqual([
      { message: 'must be 2 or more' },
      { message: 'must be whole number' }
    ])
    expect(getValueValidationErrors(5, { range: [1, 2] })).toEqual([
      { message: 'must be between 1 and 2' }
    ])
  })

  it('passes the other validations to the validators', () => {
    // Unchanged passwords are `undefined` and satisfy `required`:
    const validations = { required: true, password: true }
    expect(getValueValidationErrors(undefined, validations)).toEqual([])
    expect(getValueValidationErrors(null, validations)).toEqual([
      { message: 'is required' }
    ])
  })

  it('ignores unknown validations', () => {
    expect(getValueValidationErrors('a', { unknown: true })).toEqual([])
  })
})

describe('getDataValidationErrors()', () => {
  const required = { message: 'is required' }

  it('returns `null` for valid data', () => {
    const schema = {
      components: {
        title: { type: 'text', required: true }
      }
    }
    expect(getDataValidationErrors(schema, { title: 'Title' })).toBe(null)
  })

  it('returns errors by data path, in the format of server errors', () => {
    const schema = {
      components: {
        title: { type: 'text', required: true },
        count: { type: 'integer', min: 1 },
        note: { type: 'text' }
      }
    }
    expect(getDataValidationErrors(schema, { title: '', count: 0.5 })).toEqual({
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
    expect(
      getDataValidationErrors(schema, {}, { dataPath: 'items/0' })
    ).toEqual({
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
    expect(getDataValidationErrors(schema, {})).toEqual({
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
    expect(getDataValidationErrors(schema, data)).toEqual({
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
    expect(getDataValidationErrors(schema, data)).toBe(null)
    expect(getDataValidationErrors(schema, { ...data, show: true })).toEqual({
      'a': [required],
      'b': [required],
      'items/0/c': [required],
      'd': [required]
    })
  })

  it('skips sources with their own resource', () => {
    const schema = {
      components: {
        items: {
          type: 'list',
          resource: { path: 'items' },
          form: {
            type: 'form',
            components: { title: { type: 'text', required: true } }
          }
        }
      }
    }
    expect(getDataValidationErrors(schema, { items: [{}] })).toBe(null)
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
    expect(getDataValidationErrors(schema, { name: '  ' })).toEqual({
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
      getDataValidationErrors(schema, {}, { dataPath: 'item', rootData })
    ).toEqual({ 'item/name': [required] })
  })
})

describe('getMatchingValidationErrors()', () => {
  const required = [{ message: 'is required' }]
  const errors = {
    'title': required,
    'items/0/title': required,
    'items/1/name': required
  }

  it('matches data paths with functions', () => {
    expect(
      getMatchingValidationErrors(errors, dataPath => dataPath.length > 5)
    ).toEqual({
      'items/0/title': required,
      'items/1/name': required
    })
  })

  it('matches data paths with regular expressions', () => {
    expect(getMatchingValidationErrors(errors, /^items\/\d+\/title$/)).toEqual(
      { 'items/0/title': required }
    )
  })

  it('matches normalized data paths and arrays of them', () => {
    expect(getMatchingValidationErrors(errors, 'items[1].name')).toEqual({
      'items/1/name': required
    })
    expect(getMatchingValidationErrors(errors, ['title', 'items/1/name']))
      .toEqual({
        'title': required,
        'items/1/name': required
      })
  })

  it('returns `null` if nothing matches', () => {
    expect(getMatchingValidationErrors(errors, 'name')).toBe(null)
    expect(getMatchingValidationErrors(null, /.*/)).toBe(null)
  })
})
