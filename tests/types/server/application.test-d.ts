import { assertType, expectTypeOf, describe, it } from 'vitest'
import type {
  Application,
  ApplicationConfig,
  AssetReference,
  Model,
  ModelAsset,
  Storage
} from '@ditojs/server'
import type { app } from './fixtures.ts'

describe('Application', () => {
  it('models property exists', () => {
    type App = typeof app
    expectTypeOf<App['models']>()
      .not.toBeAny()
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

  it('addStorage requires a name for configurations', () => {
    const application = {} as Application
    application.addStorage({ type: 'disk', path: 'uploads' }, 'uploads')
    application.addStorage({} as Storage)
    // @ts-expect-error: Storage configurations need a name.
    application.addStorage({ type: 'disk', path: 'uploads' })
  })

  it('asset methods always return arrays', () => {
    type App = typeof app
    expectTypeOf<ReturnType<App['createAssets']>>().toEqualTypeOf<
      Promise<Model[]>
    >()
    expectTypeOf<ReturnType<App['releaseUnusedAssets']>>().toEqualTypeOf<
      Promise<Model[]>
    >()
    expectTypeOf<ReturnType<App['getAssetReferences']>>().toEqualTypeOf<
      Promise<AssetReference[]>
    >()
    expectTypeOf<AssetReference['dataPath']>().toEqualTypeOf<string>()
    expectTypeOf<AssetReference['config']>().toEqualTypeOf<ModelAsset>()
    expectTypeOf<
      Awaited<ReturnType<App['recountAssets']>>['missing'][number]['references']
    >().toEqualTypeOf<AssetReference[]>()
  })

  it('accepts credentials and passkeys in app.auth', () => {
    assertType<ApplicationConfig>({
      app: {
        session: { modelClass: 'Session' },
        auth: {
          credentials: { modelClass: 'Credential' },
          passkeys: {
            name: 'Example',
            id: 'example.com',
            origins: ['https://example.com']
          }
        }
      }
    })
  })

  it('accepts a password reset in app.auth', () => {
    assertType<ApplicationConfig>({
      app: {
        session: { modelClass: 'Session' },
        auth: {
          credentials: { modelClass: 'Credential', secret: 'secret' },
          passwordReset: {
            confirmUrl: 'https://example.com/admin/?password-reset={token}',
            expires: '30m'
          }
        }
      }
    })
  })
})
