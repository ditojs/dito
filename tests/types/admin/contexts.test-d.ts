import { expectTypeOf, describe, it } from 'vitest'
import type {
  AdminContext,
  AdminUser,
  DataContext,
  SchemaContext,
  DataModel,
  ResourceContext,
  RouteContext,
  SourceContext,
  SubmitButton,
  UiRegistry
} from '@ditojs/admin'

describe('contexts', () => {
  it('provides the context of the admin', () => {
    expectTypeOf<AdminContext['user']>().toEqualTypeOf<SchemaContext['user']>()
    expectTypeOf<SchemaContext['user']>().toEqualTypeOf<AdminUser | null>()
    expectTypeOf<AdminContext['notify']>()
      .toEqualTypeOf<SchemaContext['notify']>()
    expectTypeOf<AdminContext['showDialog']>()
      .toEqualTypeOf<SchemaContext['showDialog']>()
    expectTypeOf<AdminContext['loadingTracker']['isLoading']>().toBeBoolean()
    expectTypeOf<AdminContext['ui']>().toEqualTypeOf<UiRegistry>()
    expectTypeOf<AdminContext['ui']['routes']>()
      .toEqualTypeOf<readonly RouteContext[]>()
  })

  it('provides the contexts of data and routes', () => {
    expectTypeOf<DataContext['model']>().toEqualTypeOf<DataModel>()
    expectTypeOf<DataContext['isDirty']>().toBeBoolean()
    expectTypeOf<DataContext['revealErrors']>().returns.resolves.toBeVoid()
    expectTypeOf<DataModel['isEdited']>().toBeBoolean()
    expectTypeOf<DataModel['markEdited']>().returns.toBeVoid()
    expectTypeOf<DataModel['mergeFromServer']>()
      .returns.toEqualTypeOf<object>()
    expectTypeOf<RouteContext['parent']>().toEqualTypeOf<RouteContext | null>()
    expectTypeOf<RouteContext['dataContext']>()
      .toEqualTypeOf<DataContext>()
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
    expectTypeOf<SourceContext['resourceContext']>()
      .toEqualTypeOf<ResourceContext | null>()
    expectTypeOf<SourceContext['verbs']>()
      .toEqualTypeOf<Record<string, string>>()
    expectTypeOf<ResourceContext['submit']>()
      .returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf<ResourceContext['submit']>()
      .parameter(0)
      .toEqualTypeOf<SubmitButton>()
    expectTypeOf<SubmitButton['context']>().toEqualTypeOf<SchemaContext>()
    expectTypeOf<RouteContext['resourceContext']>()
      .toEqualTypeOf<ResourceContext | null>()
    expectTypeOf<RouteContext['submit']>()
      .returns.toEqualTypeOf<Promise<boolean>>()
  })
})
