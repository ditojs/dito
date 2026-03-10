import { expectTypeOf, describe, it } from 'vitest'
import type {
  DitoComponentInstanceBase,
  DitoFormInstance,
  DitoViewInstance,
  DitoContext
} from '../index.d.ts'
import type { Entry, ParentWithMarkers } from './fixtures.ts'

describe('DitoComponentInstanceBase and DitoFormInstance', () => {
  it('item strips never keys from ParentWithMarkers', () => {
    type Instance = DitoComponentInstanceBase<ParentWithMarkers>
    expectTypeOf<Instance['item']>().toHaveProperty('id')
    expectTypeOf<Instance['item']>().toHaveProperty('title')
    expectTypeOf<Instance['item']>().not.toHaveProperty('viewButton')
    expectTypeOf<Instance['item']>().not.toHaveProperty('spacer')
  })

  it('has expected properties with correct types', () => {
    type Instance = DitoComponentInstanceBase<Entry>
    expectTypeOf<Instance['focused']>().toBeBoolean()
    expectTypeOf<Instance['isDirty']>().toBeBoolean()
    expectTypeOf<Instance['isValid']>().toBeBoolean()
    expectTypeOf<Instance['errors']>().toEqualTypeOf<string[] | null>()
    expectTypeOf<Instance['name']>().toBeString()
    expectTypeOf<Instance['dataPath']>().toBeString()
  })

  it('DitoFormInstance extends base with item and form properties', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['item']['title']>().toBeString()
    expectTypeOf<Instance['isCreating']>().toBeBoolean()
    expectTypeOf<Instance['submit']>().returns.toEqualTypeOf<
      Promise<boolean>
    >()
  })

  it('DitoFormInstance has form methods', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['cancel']>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<Instance['close']>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<Instance['validateAll']>().returns.toBeBoolean()
  })
})

describe('DitoViewInstance', () => {
  it('has view properties with correct types', () => {
    type Instance = DitoViewInstance<Entry>
    expectTypeOf<Instance['isView']>().toEqualTypeOf<true>()
    expectTypeOf<Instance['label']>().toBeString()
    expectTypeOf<Instance['isSingleComponentView']>().toBeBoolean()
  })

  it('context is typed with item type', () => {
    type Instance = DitoComponentInstanceBase<Entry>
    expectTypeOf<Instance['context']>().toEqualTypeOf<DitoContext<Entry>>()
  })
})
