import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Field, Fields, FormSchema } from '@ditojs/admin'
import type {
  Address,
  Entry,
  Parent,
  ParentWithAddress,
  ParentWithMarkers
} from './fixtures.ts'

describe('Fields', () => {
  it('accepts data-only fields', () => {
    assertType<Fields<Parent>>({
      title: { type: 'text' }
    })
  })

  it('infers array element type for list fields', () => {
    assertType<Fields<Parent>>({
      entries: {
        type: 'list',
        form: {
          type: 'form',
          fields: {
            title: { type: 'text' }
          }
        } satisfies FormSchema<Entry>
      }
    })
  })

  it('accepts UI-only keys for non-data fields', () => {
    assertType<Fields<ParentWithMarkers>>({
      viewButton: {
        type: 'button',
        text: 'View',
        onClick({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item).toHaveProperty('title')
          expectTypeOf(item).toHaveProperty('entries')
          expectTypeOf(item).not.toHaveProperty('viewButton')
          expectTypeOf(item).not.toHaveProperty('spacer')
        }
      }
    })
  })

  it('provides typed item in callbacks for data keys', () => {
    assertType<Fields<Parent>>({
      title: {
        type: 'text',
        formatValue({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          expectTypeOf(item.entries).toEqualTypeOf<Entry[]>()
        }
      }
    })
  })
})

describe('Fields with object-valued keys', () => {
  it('provides parent item type in field callbacks, not the value type', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'component',
        component: {} as any,
        label({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item).toHaveProperty('title')
          expectTypeOf(item).toHaveProperty('address')
          // item should be ParentWithAddress, not Address
          expectTypeOf(item.title).toBeString()
          return 'Address'
        }
      }
    })
  })

  it('provides typed option from value type in multiselect', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'multiselect',
        options: {
          label({ option }) {
            expectTypeOf(option).not.toBeAny()
            expectTypeOf(option).toHaveProperty('street')
            expectTypeOf(option).toHaveProperty('city')
            return option.street
          }
        }
      }
    })
  })

  it('provides nested item type in source field forms', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'object',
        form: {
          type: 'form',
          fields: {
            street: { type: 'text' },
            city: { type: 'text' }
          }
        } satisfies FormSchema<Address>
      }
    })
  })
})

describe('Fields negative tests', () => {
  it('rejects unknown keys', () => {
    assertType<Fields<Parent>>({
      title: { type: 'text' },
      // @ts-expect-error 'nonExistent' is not a key of Parent
      nonExistent: { type: 'text' }
    })
  })
})

describe('Fields<any> compatibility', () => {
  it('Fields<Specific> is assignable to Fields<any>', () => {
    const specific: Fields<Parent> = {
      title: { type: 'text' }
    }
    assertType<Fields<any>>(specific)
  })

  it('Field<Specific> is assignable to Field<any>', () => {
    const specific: Field<Parent> = { type: 'text' }
    assertType<Field<any>>(specific)
    assertType<Field>(specific)
  })
})
