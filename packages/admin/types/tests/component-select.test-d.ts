import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { SelectSchema, MultiselectSchema } from '../index.d.ts'
import type { Entry } from './fixtures.ts'

describe('SelectSchema', () => {
  it('accepts simple string array options', () => {
    assertType<SelectSchema<Entry>>({
      type: 'select',
      options: ['draft', 'published', 'archived']
    })
  })

  it('accepts label/value object options', () => {
    assertType<SelectSchema<Entry>>({
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' }
      ]
    })
  })

  it('accepts options with data callback', () => {
    assertType<SelectSchema<Entry>>({
      type: 'select',
      options: {
        data({ item }) {
          expectTypeOf(item).toMatchTypeOf<Entry>()
          return [
            { label: 'Option A', value: 1 },
            { label: 'Option B', value: 2 }
          ]
        },
        label: 'label',
        value: 'value'
      }
    })
  })

  it('accepts relate and relateBy', () => {
    assertType<SelectSchema<Entry>>({
      type: 'select',
      relate: true,
      relateBy: 'id'
    })
  })
})

describe('MultiselectSchema', () => {
  it('accepts multiple, searchable, taggable', () => {
    assertType<MultiselectSchema<Entry>>({
      type: 'multiselect',
      multiple: true,
      searchable: true,
      taggable: true,
      stayOpen: true
    })
  })

  it('accepts typed $Option with search callback', () => {
    type Tag = { id: number; name: string }

    assertType<MultiselectSchema<Entry, Tag>>({
      type: 'multiselect',
      searchable: true,
      search({ item, query }) {
        expectTypeOf(item).toMatchTypeOf<Entry>()
        expectTypeOf(query).toBeString()
        return [] as Tag[]
      },
      options: {
        data: [] as Tag[],
        label: 'name',
        value: 'id'
      }
    })
  })

  it('accepts label/value as accessor callbacks with typed option', () => {
    type Tag = { id: number; name: string }

    assertType<MultiselectSchema<Entry, Tag>>({
      type: 'multiselect',
      options: {
        data: [] as Tag[],
        label({ option }) {
          expectTypeOf(option).not.toBeAny()
          return option.name
        },
        value({ option }) {
          expectTypeOf(option).not.toBeAny()
          return option.id
        }
      }
    })
  })

  it('rejects invalid type', () => {
    assertType<MultiselectSchema<Entry>>({
      // @ts-expect-error 'radio' is not assignable to 'multiselect'
      type: 'radio'
    })
  })
})
