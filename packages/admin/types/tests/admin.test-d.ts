import { assertType, describe, it } from 'vitest'
import type { default as DitoAdmin, View } from '../index.d.ts'
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
})
