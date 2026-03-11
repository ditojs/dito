import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Component, Components, Form } from '../index.d.ts'
import type { Entry, Parent, ParentWithMarkers } from './fixtures.ts'

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
