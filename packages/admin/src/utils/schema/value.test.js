import { vi } from 'vitest'
import SchemaContext from '../../SchemaContext.js'
import { defineType } from './types.ts'
import {
  nestableTraits,
  sourceTraits,
  numberTraits,
  colorTraits
} from '../../types/traits.ts'
import {
  shouldRenderSchema,
  getSchemaValue,
  resolveValue,
  getMultipleValue,
  parseEditedValue
} from './value.js'

// Define minimal types, as the actual type components can't be
// imported without a Vue SFC compiler:
defineType({ type: 'text' })
defineType({ ...nestableTraits, type: 'section' })
defineType({ ...sourceTraits, type: 'list', sourceType: 'list' })
defineType({ type: 'tags', defaultMultiple: true })
defineType({ ...numberTraits, type: ['number', 'integer'] })
defineType({ ...colorTraits, type: 'color' })

describe('shouldRenderSchema()', () => {
  it(`doesn't evaluate the components of sources for their items`, () => {
    // `SchemaContext` needs a component to inherit from:
    const context = new SchemaContext(
      {},
      { data: { links: null }, dataPath: '' }
    )
    const condition = vi.fn(({ item }) => !!item.url)
    const links = {
      type: 'list',
      fields: { url: { type: 'text', if: condition } }
    }
    expect(shouldRenderSchema(links, context)).toBe(true)
    expect(condition).not.toHaveBeenCalled()
  })

  it('hides sections whose components are all hidden', () => {
    const context = new SchemaContext({}, { data: {}, dataPath: '' })
    const section = {
      type: 'section',
      fields: { url: { type: 'text', if: () => false } }
    }
    expect(shouldRenderSchema(section, context)).toBe(false)
  })

  it('hides forms whose components are all hidden', () => {
    const context = new SchemaContext({}, { data: {}, dataPath: '' })
    const form = {
      type: 'form',
      fields: { title: { type: 'text', if: () => false } }
    }
    expect(shouldRenderSchema(form, context)).toBe(false)
  })
})

describe('getSchemaValue()', () => {
  it('reads data paths in array format', () => {
    const schema = { options: { label: 'Title' } }
    expect(getSchemaValue(['options', 'label'], { schema })).toBe('Title')
    expect(
      getSchemaValue(['options', 'missing', 'label'], {
        schema,
        default: 'None'
      })
    ).toBe('None')
  })

  it('returns the default without a schema', () => {
    expect(getSchemaValue('label', { default: 'Untitled' })).toBe('Untitled')
    expect(getSchemaValue('label')).toBe(undefined)
  })

  it('calls `default()` with the context, unless functions are expected', () => {
    const context = { item: { title: 'Emma' } }
    const getTitle = ({ item }) => item.title
    expect(getSchemaValue('label', { default: getTitle, context })).toBe(
      'Emma'
    )
    expect(
      getSchemaValue('render', { type: Function, default: getTitle, context })
    ).toBe(getTitle)
    expect(
      getSchemaValue('label', { default: getTitle, callback: false })
    ).toBe(getTitle)
  })

  it('converts values to the expected type', () => {
    expect(
      getSchemaValue('pageSize', { type: Number, schema: { pageSize: '20' } })
    ).toBe(20)
    expect(
      getSchemaValue('creatable', {
        type: [Boolean, Object],
        schema: { creatable: () => 1 }
      })
    ).toBe(true)
  })

  it('skips expected types that have no conversion', () => {
    expect(
      getSchemaValue('pageSize', {
        type: [Function, Number],
        schema: { pageSize: '20' }
      })
    ).toBe(20)
    // Without any conversion, the value is returned as it is:
    expect(
      getSchemaValue('render', { type: Function, schema: { render: 'none' } })
    ).toBe('none')
  })
})

describe('resolveValue()', () => {
  it('calls functions with contexts that are passed directly', () => {
    const context = { item: { title: 'Emma' } }
    expect(resolveValue(({ item }) => item.title, context)).toBe('Emma')
  })

  it('clones values, so that they are not shared', () => {
    const tags = ['new']
    const value = resolveValue(tags, {})
    expect(value).toEqual(tags)
    expect(value).not.toBe(tags)
  })
})

describe('getMultipleValue()', () => {
  it('prefers `multiple` over the `defaultMultiple` of the type', () => {
    expect(getMultipleValue({ type: 'tags' })).toBe(true)
    expect(getMultipleValue({ type: 'tags', multiple: false })).toBe(false)
    expect(getMultipleValue({ type: 'text' })).toBe(false)
    expect(getMultipleValue({ type: 'text', multiple: true })).toBe(true)
  })
})

describe('parseEditedValue()', () => {
  const parse = (schema, value) =>
    parseEditedValue(schema, value, value => ({ schema, value }))

  it('parses the entered strings of number types', () => {
    expect(parse({ type: 'number' }, '4.5')).toBe(4.5)
    expect(parse({ type: 'integer' }, '42')).toBe(42)
    expect(parse({ type: 'number' }, '')).toBe(null)
    expect(parse({ type: 'number' }, null)).toBe(null)
  })

  it('converts colors to the format of `colorFormat`', () => {
    expect(parse({ type: 'color' }, 'ff8000')).toBe('#ff8000')
    expect(parse({ type: 'color' }, 'rgba(0, 0, 255, 0.5)')).toBe('#0000ff80')
    expect(
      parse({ type: 'color', colorFormat: 'hex3' }, '#ff0000')
    ).toBe('#f00')
    expect(parse({ type: 'color', colorFormat: 'rgb' }, '#ff0000')).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 1
    })
    expect(parse({ type: 'color', colorFormat: 'hsl' }, '#ff0000')).toEqual({
      h: 0,
      s: 1,
      l: 0.5,
      a: 1
    })
    expect(parse({ type: 'color' }, null)).toBe(null)
  })

  it('calls `parseValue()` with the value parsed by the type', () => {
    const schema = { type: 'number', parseValue: ({ value }) => value * 2 }
    expect(parse(schema, '21')).toBe(42)
  })
})
