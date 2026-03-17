import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Component, Components, Form } from '@ditojs/admin'
import type {
  Address,
  Entry,
  Parent,
  ParentWithAddress,
  ParentWithMarkers
} from './fixtures.ts'

describe('Components', () => {
  it('accepts data-only components', () => {
    assertType<Components<Parent>>({
      title: { type: 'text' }
    })
  })

  it('infers array element type for list components', () => {
    assertType<Components<Parent>>({
      entries: {
        type: 'list',
        form: {
          type: 'form',
          components: {
            title: { type: 'text' }
          }
        } satisfies Form<Entry>
      }
    })
  })

  it('accepts UI-only keys for non-data components', () => {
    assertType<Components<ParentWithMarkers>>({
      viewButton: {
        type: 'button',
        text: 'View',
        events: {
          click({ item }) {
            expectTypeOf(item).not.toBeAny()
            expectTypeOf(item).toHaveProperty('title')
            expectTypeOf(item).toHaveProperty('entries')
            expectTypeOf(item).not.toHaveProperty('viewButton')
            expectTypeOf(item).not.toHaveProperty('spacer')
          }
        }
      }
    })
  })

  it('provides typed item in callbacks for data keys', () => {
    assertType<Components<Parent>>({
      title: {
        type: 'text',
        format({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          expectTypeOf(item.entries).toEqualTypeOf<Entry[]>()
        }
      }
    })
  })
})

describe('Components with object-valued keys', () => {
  it('provides parent item type in field component callbacks, not the value type', () => {
    assertType<Components<ParentWithAddress>>({
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
    assertType<Components<ParentWithAddress>>({
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

  it('provides nested item type in source component forms', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'object',
        form: {
          type: 'form',
          components: {
            street: { type: 'text' },
            city: { type: 'text' }
          }
        } satisfies Form<Address>
      }
    })
  })
})

describe('Components negative tests', () => {
  it('rejects unknown keys', () => {
    assertType<Components<Parent>>({
      title: { type: 'text' },
      // @ts-expect-error 'nonExistent' is not a key of Parent
      nonExistent: { type: 'text' }
    })
  })
})

describe('Components<any> compatibility', () => {
  it('Components<Specific> is assignable to Components<any>', () => {
    const specific: Components<Parent> = {
      title: { type: 'text' }
    }
    assertType<Components<any>>(specific)
  })

  it('Component<Specific> is assignable to Component<any>', () => {
    const specific: Component<Parent> = { type: 'text' }
    assertType<Component<any>>(specific)
    assertType<Component>(specific)
  })
})
