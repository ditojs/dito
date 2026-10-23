import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  ObjectSchema,
  TreeListSchema,
  FormSchema,
  Fields
} from '@ditojs/admin'
import type { Address, Entry, ParentWithAddress } from './fixtures.ts'

describe('ObjectSchema', () => {
  it('accepts typed form', () => {
    assertType<ObjectSchema<Address>>({
      type: 'object',
      form: {
        type: 'form',
        fields: {
          street: { type: 'text' },
          city: { type: 'text' }
        }
      } satisfies FormSchema<Address>
    })
  })

  it('accepts typed columns', () => {
    assertType<ObjectSchema<Address>>({
      type: 'object',
      columns: {
        street: { label: 'Street' },
        city: { label: 'City' }
      }
    })
  })

  it('rejects unknown key in columns array', () => {
    assertType<ObjectSchema<Address>>({
      type: 'object',
      // @ts-expect-error 'zipCode' is not a key of Address
      columns: ['street', 'zipCode']
    })
  })

  it('works inside Fields for a data key', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'object',
        form: {
          type: 'form',
          fields: {
            street: { type: 'text' }
          }
        } satisfies FormSchema<Address>
      }
    })
  })
})

describe('TreeListSchema', () => {
  it('accepts typed form', () => {
    assertType<TreeListSchema<Entry>>({
      type: 'tree-list',
      form: {
        type: 'form',
        fields: {
          title: { type: 'text' }
        }
      } satisfies FormSchema<Entry>
    })
  })

  it('accepts collapsed, but not collapsible or expanded', () => {
    assertType<TreeListSchema<Entry>>({
      type: 'tree-list',
      collapsed: ({ item }) => item.title !== 'About'
    })
    assertType<TreeListSchema<Entry>>({
      type: 'tree-list',
      // @ts-expect-error: Tree items are always collapsible.
      collapsible: true
    })
    assertType<TreeListSchema<Entry>>({
      type: 'tree-list',
      // @ts-expect-error: Trees use `collapsed: false`.
      expanded: true
    })
  })

  it('accepts details with typed values, but without sorting', () => {
    assertType<TreeListSchema<Entry>>({
      type: 'tree-list',
      details: {
        title: {
          label: 'Title',
          render({ value }) {
            expectTypeOf(value).toBeString()
            return value
          }
        }
      }
    })
    assertType<TreeListSchema<Entry>>({
      type: 'tree-list',
      // @ts-expect-error: Details aren't sortable.
      details: { title: { sortable: true } }
    })
  })
})
