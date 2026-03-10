import { expectTypeOf, describe, it } from 'vitest'
import type { Application, Model } from '../index.d.ts'
import type { app } from './fixtures.ts'

describe('Application', () => {
  it('models property exists', () => {
    type App = typeof app
    expectTypeOf<App['models']>().toHaveProperty('Item')
    expectTypeOf<App['models']>().toHaveProperty('User')
  })

  it('start and stop return promises', () => {
    type App = typeof app
    expectTypeOf<ReturnType<App['start']>>()
      .toEqualTypeOf<Promise<void>>()
    expectTypeOf<ReturnType<App['stop']>>()
      .toEqualTypeOf<Promise<void>>()
  })

  it('addModels accepts model class map', () => {
    type App = typeof app
    expectTypeOf<App['addModels']>().toBeFunction()
  })
})
