import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Fields } from '@ditojs/admin'
import type { Parent } from './fixtures.ts'

type ParentWithPanel = Parent & {
  links: never
}

describe('Panel fields', () => {
  it('accepts panels that share the data of their schema', () => {
    assertType<Fields<ParentWithPanel>>({
      links: {
        type: 'panel',
        label: 'Links',
        fields: {
          title: { type: 'text' }
        }
      }
    })
  })

  it('provides the typed item in callbacks of panel fields', () => {
    assertType<Fields<ParentWithPanel>>({
      links: {
        type: 'panel',
        fields: {
          title: {
            type: 'text',
            if({ item }) {
              expectTypeOf(item.title).toBeString()
              return true
            }
          }
        }
      }
    })
  })

  it('rejects invalid field keys in panels', () => {
    assertType<Fields<ParentWithPanel>>({
      links: {
        type: 'panel',
        fields: {
          // @ts-expect-error 'nonExistent' is not a key of ParentWithPanel
          nonExistent: { type: 'text' }
        }
      }
    })
  })
})
