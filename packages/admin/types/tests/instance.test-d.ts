import { expectTypeOf, describe, it } from 'vitest'
import type { DitoFormInstance, DitoContext } from '../index.d.ts'
import type { Entry } from './fixtures.ts'

describe('DitoComponentInstanceBase and DitoFormInstance', () => {
  it('DitoFormInstance extends base with item and form properties', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['item']['title']>().toBeString()
    expectTypeOf<Instance['isCreating']>().toBeBoolean()
    expectTypeOf<Instance['submit']>().returns.toEqualTypeOf<Promise<boolean>>()
  })

  it('context is typed with item type', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['context']>().toEqualTypeOf<DitoContext<Entry>>()
  })
})
