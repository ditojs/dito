import { assertType, describe, expectTypeOf, it } from 'vitest'
import type { default as DitoAdmin, View } from '@ditojs/admin'
import { DitoAdmin as NamedDitoAdmin } from '@ditojs/admin'
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
