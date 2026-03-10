import { assertType, expectTypeOf, describe, it } from 'vitest'
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

  it('constructor accepts element as string selector', () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      {
        views: {
          entries: {
            type: 'view',
            component: { type: 'list' }
          }
        }
      }
    ])
  })

  it('views accept View types', () => {
    const entryView: View<Entry> = {
      type: 'view',
      component: {
        type: 'list',
        itemLabel: 'title'
      }
    }

    assertType<ConstructorParameters<typeof DitoAdmin>>([
      document.body,
      { views: { entries: entryView } }
    ])
  })

  it('has expected instance properties', () => {
    expectTypeOf<DitoAdmin['el']>()
      .toEqualTypeOf<Element>()
    expectTypeOf<DitoAdmin['app']>()
      .toMatchTypeOf<import('vue').App>()
  })
})
