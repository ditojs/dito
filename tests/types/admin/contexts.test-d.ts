import { expectTypeOf, describe, it } from 'vitest'
import type {
  AdminContext,
  AdminUser,
  DitoAdmin,
  SchemaContext
} from '@ditojs/admin'
// The contexts of data, routes, sources and resources are internal:
// @ts-expect-error
import type { DataContext } from '@ditojs/admin'
// @ts-expect-error
import type { RouteContext } from '@ditojs/admin'
// @ts-expect-error
import type { DataModel } from '@ditojs/admin'

describe('contexts', () => {
  it('provides the context of the admin', () => {
    expectTypeOf<DitoAdmin['context']>().toEqualTypeOf<AdminContext>()
    expectTypeOf<AdminContext['user']>().toEqualTypeOf<SchemaContext['user']>()
    expectTypeOf<SchemaContext['user']>().toEqualTypeOf<AdminUser | null>()
    expectTypeOf<AdminContext['notify']>()
      .toEqualTypeOf<SchemaContext['notify']>()
    expectTypeOf<AdminContext['showDialog']>()
      .toEqualTypeOf<SchemaContext['showDialog']>()
    expectTypeOf<AdminContext>().not.toHaveProperty('ui')
    expectTypeOf<AdminContext>().not.toHaveProperty('loadingTracker')
  })
})

export type { DataContext, RouteContext, DataModel }
