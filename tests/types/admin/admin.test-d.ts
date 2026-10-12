import { assertType, describe, expectTypeOf, it } from 'vitest'
import type {
  default as DitoAdmin,
  TypeDescriptor,
  View
} from '@ditojs/admin'
import {
  DitoAdmin as NamedDitoAdmin,
  defineType,
  optionsTraits
} from '@ditojs/admin'
import type { Entry } from './fixtures.ts'

describe('DitoAdmin', () => {
  it('constructor accepts element and views option', () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      document.body,
      {
        views: {
          entries: {
            type: 'view',
            component: {
              type: 'list',
              form: {
                type: 'form',
                components: {
                  title: { type: 'text' }
                }
              }
            }
          } satisfies View<Entry>
        }
      }
    ])
  })

  it('is also exported by name', () => {
    expectTypeOf(NamedDitoAdmin).toEqualTypeOf<typeof DitoAdmin>()
  })
})

describe('defineType()', () => {
  it('accepts descriptors and returns them', () => {
    expectTypeOf(
      defineType({
        type: 'rating',
        component: { template: '<span />' },
        defaultValue: 0,
        sourceType: 'list',
        excludeValue: ({ value }) => value === 0,
        getValidations: schema => ({ range: [0, schema.max ?? 5] })
      })
    ).toEqualTypeOf<TypeDescriptor>()
  })

  it('accepts several types', () => {
    defineType({ type: ['rating', 'stars'], component: {} })
  })

  it('requires the type and the component', () => {
    // @ts-expect-error - `component` is missing.
    defineType({ type: 'rating' })
  })

  it('accepts shared traits', () => {
    defineType({ type: 'tags', component: {}, ...optionsTraits })
  })

  it('refuses unknown source types', () => {
    defineType({
      type: 'rating',
      component: {},
      // @ts-expect-error - Sources hold lists or objects.
      sourceType: 'tree'
    })
  })
})
