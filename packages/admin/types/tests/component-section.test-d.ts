import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Components, Form } from '../index.d.ts'
import type { Address, Entry, Parent, ParentWithAddress } from './fixtures.ts'

type ParentWithSection = Parent & {
  details: never
}

describe('Section components', () => {
  it('accepts section with nested components', () => {
    assertType<Components<ParentWithSection>>({
      details: {
        type: 'section',
        components: {
          title: { type: 'text' }
        }
      }
    })
  })

  it('provides typed item in section callbacks', () => {
    assertType<Components<ParentWithSection>>({
      details: {
        type: 'section',
        label({ item }) {
          expectTypeOf(item.title).toBeString()
          expectTypeOf(item.entries).toEqualTypeOf<Entry[]>()
          expectTypeOf(item).not.toHaveProperty('details')
          return item.title
        }
      }
    })
  })

  it('rejects invalid component keys in section', () => {
    assertType<Components<ParentWithSection>>({
      details: {
        type: 'section',
        components: {
          title: { type: 'text' },
          // @ts-expect-error 'nonExistent' is not a key of ParentWithSection
          nonExistent: { type: 'text' }
        }
      }
    })
  })

  it('accepts section with form prop', () => {
    const sectionForm: Form<Parent> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }

    assertType<Components<ParentWithSection>>({
      details: {
        type: 'section',
        form: sectionForm
      }
    })
  })
})

describe('Section tabs', () => {
  it('accepts tabs on a non-nested section', () => {
    assertType<Components<ParentWithSection>>({
      details: {
        type: 'section',
        tabs: {
          general: {
            type: 'tab',
            components: {
              title: { type: 'text' }
            }
          }
        }
      }
    })
  })

  it('accepts tabs on a nested section typed against nested data', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        tabs: {
          main: {
            type: 'tab',
            components: {
              street: { type: 'text' },
              city: { type: 'text' }
            }
          }
        }
      }
    })
  })
})

describe('Nested sections', () => {
  it('types nested section components against the value type', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        components: {
          street: { type: 'text' },
          city: { type: 'text' }
        }
      }
    })
  })

  it('rejects invalid keys in nested section components', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        components: {
          street: { type: 'text' },
          // @ts-expect-error 'zipCode' is not a key of Address
          zipCode: { type: 'text' }
        }
      }
    })
  })

  it('types item as Address in nested section callbacks', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        components: {
          street: {
            type: 'text',
            onChange({ item }) {
              expectTypeOf(item).toEqualTypeOf<Address>()
            }
          }
        }
      }
    })
  })

  it('types nested section form against the value type', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
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

  it('non-nested section on data key accepts parent item keys', () => {
    assertType<Components<ParentWithAddress>>({
      address: {
        type: 'section',
        components: {
          title: { type: 'text' }
        }
      }
    })
  })

})
