import { expectTypeOf, describe, it } from 'vitest'
import type {
  AdminContext,
  DitoFormInstance,
  DitoContext
} from '@ditojs/admin'
import type { Entry } from './fixtures.ts'

describe('DitoComponentInstanceBase and DitoFormInstance', () => {
  it('DitoFormInstance extends base with item and form properties', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['item']>().not.toBeAny()
    expectTypeOf<Instance['item']['title']>().toBeString()
    expectTypeOf<Instance['isCreating']>().toBeBoolean()
    expectTypeOf<Instance['isDirty']>().toBeBoolean()
    expectTypeOf<Instance['dataModel']['isDirty']>().toBeBoolean()
    expectTypeOf<Instance['dataModel']['isEdited']>().toBeBoolean()
    expectTypeOf<Instance['dataModel']['markEdited']>().returns.toBeVoid()
    expectTypeOf<Instance['dataModel']['mergeFromServer']>()
      .returns.toEqualTypeOf<object>()
    expectTypeOf<Instance['submit']>().returns.toEqualTypeOf<Promise<boolean>>()
  })

  it('context is typed with item type', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['context']>().not.toBeAny()
    expectTypeOf<Instance['context']>()
      .toEqualTypeOf<DitoContext<Entry>>()
  })

  it('provides the context of the admin as `admin`', () => {
    type Admin = DitoFormInstance<Entry>['admin']
    expectTypeOf<Admin>().toEqualTypeOf<AdminContext>()
    expectTypeOf<Admin['user']>().toEqualTypeOf<DitoContext['user']>()
    expectTypeOf<Admin['notify']>().toEqualTypeOf<DitoContext['notify']>()
    expectTypeOf<Admin['showDialog']>()
      .toEqualTypeOf<DitoContext['showDialog']>()
    expectTypeOf<Admin['loadingTracker']['isLoading']>().toBeBoolean()
  })
})
