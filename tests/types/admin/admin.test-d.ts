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
        types: ['rating'],
        component: { template: '<span />' },
        defaultValue: 0,
        sourceType: 'list',
        excludeValue: ({ value }) => value === 0,
        getValidations: schema => ({ range: [0, schema.max ?? 5] })
      })
    ).toEqualTypeOf<TypeDescriptor>()
  })

  it('requires the types and the component', () => {
    // @ts-expect-error - `component` is missing.
    defineType({ types: ['rating'] })
  })

  it('accepts shared traits', () => {
    defineType({ types: ['tags'], component: {}, ...optionsTraits })
  })

  it('refuses unknown source types', () => {
    defineType({
      types: ['rating'],
      component: {},
      // @ts-expect-error - Sources hold lists or objects.
      sourceType: 'tree'
    })
  })
})
