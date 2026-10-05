import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { Components } from '@ditojs/admin'
import type { Parent } from './fixtures.ts'

type ParentWithPanel = Parent & {
  links: never
}

describe('Panel components', () => {
  it('accepts panels that share the data of their schema', () => {
    assertType<Components<ParentWithPanel>>({
      links: {
        type: 'panel',
        label: 'Links',
        components: {
          title: { type: 'text' }
        }
      }
    })
  })

  it('provides the typed item in callbacks of panel components', () => {
    assertType<Components<ParentWithPanel>>({
      links: {
        type: 'panel',
        components: {
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

  it('rejects invalid component keys in panels', () => {
    assertType<Components<ParentWithPanel>>({
      links: {
        type: 'panel',
        components: {
          // @ts-expect-error 'nonExistent' is not a key of ParentWithPanel
          nonExistent: { type: 'text' }
        }
      }
    })
  })
})
