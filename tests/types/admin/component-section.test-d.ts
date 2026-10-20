import { expectTypeOf, assertType, describe, it } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { DitoSchemaField, DitoField, DitoPane } from '@ditojs/admin'
import type { Fields, FormSchema } from '@ditojs/admin'
import type { Address, Entry, Parent, ParentWithAddress } from './fixtures.ts'

type ParentWithSection = Parent & {
  details: never
}

describe('Section fields', () => {
  it('accepts section with nested fields', () => {
    assertType<Fields<ParentWithSection>>({
      details: {
        type: 'section',
        fields: {
          title: { type: 'text' }
        }
      }
    })
  })

  it('provides typed item in section callbacks', () => {
    assertType<Fields<ParentWithSection>>({
      details: {
        type: 'section',
        label({ item }) {
          expectTypeOf(item).not.toBeAny()
          expectTypeOf(item.title).toBeString()
          expectTypeOf(item.entries).toEqualTypeOf<Entry[]>()
          expectTypeOf(item).not.toHaveProperty('details')
          return item.title
        }
      }
    })
  })

  it('rejects invalid field keys in section', () => {
    assertType<Fields<ParentWithSection>>({
      details: {
        type: 'section',
        fields: {
          title: { type: 'text' },
          // @ts-expect-error 'nonExistent' is not a key of ParentWithSection
          nonExistent: { type: 'text' }
        }
      }
    })
  })

  it('accepts section with a layout component that places fields and panes', () => {
    const Layout = defineComponent({
      props: {
        schema: { type: Object, required: true },
        context: { type: Object, required: true }
      },
      setup: () => () => [
        h(DitoSchemaField, { name: 'title' }),
        h(DitoPane, { names: ['title'] }),
        h(DitoPane)
      ]
    })
    assertType<Fields<ParentWithSection>>({
      details: {
        type: 'section',
        component: Layout,
        fields: {
          title: { type: 'text' }
        }
      }
    })
    expectTypeOf(DitoSchemaField).toExtend<Component>()
    expectTypeOf(DitoPane).toExtend<Component>()
  })

  it('keeps the deprecated name DitoField', () => {
    expectTypeOf(DitoField).toEqualTypeOf<typeof DitoSchemaField>()
  })

  it('accepts section with form prop', () => {
    const sectionForm: FormSchema<ParentWithSection> = {
      type: 'form',
      fields: {
        title: { type: 'text' }
      }
    }

    assertType<Fields<ParentWithSection>>({
      details: {
        type: 'section',
        form: sectionForm
      }
    })
  })
})

describe('Section tabs', () => {
  it('accepts tabs on a non-nested section', () => {
    assertType<Fields<ParentWithSection>>({
      details: {
        type: 'section',
        tabs: {
          general: {
            type: 'tab',
            fields: {
              title: { type: 'text' }
            }
          }
        }
      }
    })
  })

  it('accepts tabs on a nested section typed against nested data', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        tabs: {
          main: {
            type: 'tab',
            fields: {
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
  it('types nested section fields against the value type', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        fields: {
          street: { type: 'text' },
          city: { type: 'text' }
        }
      }
    })
  })

  it('rejects invalid keys in nested section fields', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        fields: {
          street: { type: 'text' },
          // @ts-expect-error 'zipCode' is not a key of Address
          zipCode: { type: 'text' }
        }
      }
    })
  })

  it('types item as Address in nested section callbacks', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
        fields: {
          street: {
            type: 'text',
            onChange({ item }) {
              expectTypeOf(item).not.toBeAny()
              expectTypeOf(item).toEqualTypeOf<Address>()
            }
          }
        }
      }
    })
  })

  it('types nested section form against the value type', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'section',
        nested: true,
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

  it('non-nested section on data key accepts parent item keys', () => {
    assertType<Fields<ParentWithAddress>>({
      address: {
        type: 'section',
        fields: {
          title: { type: 'text' }
        }
      }
    })
  })
})
