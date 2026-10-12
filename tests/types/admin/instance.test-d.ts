import { expectTypeOf, describe, it } from 'vitest'
import type {
  AdminContext,
  ContainerContext,
  DitoFormInstance,
  DitoContext,
  DitoDataModel,
  ResourceContext,
  RouteContext,
  SourceContext
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

  it('provides the contexts of its container and route', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['container']>()
      .toEqualTypeOf<ContainerContext | null>()
    expectTypeOf<Instance['route']>().toEqualTypeOf<RouteContext | null>()
    expectTypeOf<ContainerContext['model']>().toEqualTypeOf<DitoDataModel>()
    expectTypeOf<ContainerContext['isDirty']>().toBeBoolean()
    expectTypeOf<RouteContext['parent']>().toEqualTypeOf<RouteContext | null>()
    expectTypeOf<RouteContext['container']>()
      .toEqualTypeOf<ContainerContext>()
    expectTypeOf<RouteContext['getCreatePath']>()
      .returns.toEqualTypeOf<string | null>()
    expectTypeOf<Instance>().not.toHaveProperty('routeComponent')
    expectTypeOf<Instance>().not.toHaveProperty('parentRouteComponent')
  })

  it('provides the contexts of its source and resource', () => {
    type Instance = DitoFormInstance<Entry>
    expectTypeOf<Instance['source']>().toEqualTypeOf<SourceContext | null>()
    expectTypeOf<Instance['resource']>()
      .toEqualTypeOf<ResourceContext | null>()
    expectTypeOf<SourceContext['query']>()
      .toEqualTypeOf<Record<string, any>>()
    expectTypeOf<ResourceContext['parent']>()
      .toEqualTypeOf<ResourceContext | null>()
    expectTypeOf<ResourceContext['submit']>()
      .returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf<RouteContext['resource']>()
      .toEqualTypeOf<ResourceContext | null>()
    expectTypeOf<Instance>().not.toHaveProperty('sourceComponent')
    expectTypeOf<Instance>().not.toHaveProperty('resourceComponent')
    expectTypeOf<Instance>().not.toHaveProperty('dataComponent')
  })
})
