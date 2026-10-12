import { expectTypeOf, describe, it } from 'vitest'
import type {
  AdminContext,
  ContainerContext,
  DitoContext,
  DitoDataModel,
  ResourceContext,
  RouteContext,
  SourceContext,
  SubmitButton,
  UiRegistry
} from '@ditojs/admin'

describe('contexts', () => {
  it('provides the context of the admin', () => {
    expectTypeOf<AdminContext['user']>().toEqualTypeOf<DitoContext['user']>()
    expectTypeOf<AdminContext['notify']>()
      .toEqualTypeOf<DitoContext['notify']>()
    expectTypeOf<AdminContext['showDialog']>()
      .toEqualTypeOf<DitoContext['showDialog']>()
    expectTypeOf<AdminContext['loadingTracker']['isLoading']>().toBeBoolean()
    expectTypeOf<AdminContext['ui']>().toEqualTypeOf<UiRegistry>()
    expectTypeOf<AdminContext['ui']['routes']>()
      .toEqualTypeOf<readonly RouteContext[]>()
  })

  it('provides the contexts of containers and routes', () => {
    expectTypeOf<ContainerContext['model']>().toEqualTypeOf<DitoDataModel>()
    expectTypeOf<ContainerContext['isDirty']>().toBeBoolean()
    expectTypeOf<ContainerContext['revealErrors']>().returns.resolves.toBeVoid()
    expectTypeOf<DitoDataModel['isEdited']>().toBeBoolean()
    expectTypeOf<DitoDataModel['markEdited']>().returns.toBeVoid()
    expectTypeOf<DitoDataModel['mergeFromServer']>()
      .returns.toEqualTypeOf<object>()
    expectTypeOf<RouteContext['parent']>().toEqualTypeOf<RouteContext | null>()
    expectTypeOf<RouteContext['container']>()
      .toEqualTypeOf<ContainerContext>()
    expectTypeOf<RouteContext['getCreatePath']>()
      .returns.toEqualTypeOf<string | null>()
    expectTypeOf<RouteContext['schema']>().toBeNullable()
  })

  it('provides the contexts of sources and resources', () => {
    expectTypeOf<SourceContext['query']>()
      .toEqualTypeOf<Record<string, any>>()
    expectTypeOf<SourceContext['getSourceItemLabel']>()
      .parameter(0)
      .toBeAny()
    expectTypeOf<ResourceContext['parent']>()
      .toEqualTypeOf<ResourceContext | null>()
    expectTypeOf<ResourceContext['submit']>()
      .returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf<ResourceContext['submit']>()
      .parameter(0)
      .toEqualTypeOf<SubmitButton>()
    expectTypeOf<SubmitButton['context']>().toEqualTypeOf<DitoContext>()
    expectTypeOf<RouteContext['resource']>()
      .toEqualTypeOf<ResourceContext | null>()
  })
})
