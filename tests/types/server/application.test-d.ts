import { assertType, expectTypeOf, describe, it } from 'vitest'
import {
  PasskeyService,
  TotpService,
  type Application,
  type ApplicationConfig,
  type AssetReference,
  type CredentialModel,
  type KoaContext,
  type Model,
  type ModelAsset,
  type Services,
  type Storage,
  type UserModel
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
    expectTypeOf<App['releaseUnusedAssets']>().toBeCallableWith({
      olderThan: 0
    })
    expectTypeOf<App['releaseUnusedAssets']>().toBeCallableWith({
      // @ts-expect-error: `timeThreshold` is renamed to `olderThan`.
      timeThreshold: 0
    })
    expectTypeOf<ReturnType<App['getAssetReferences']>>().toEqualTypeOf<
      Promise<AssetReference[]>
    >()
    expectTypeOf<AssetReference['dataPath']>().toEqualTypeOf<string>()
    expectTypeOf<AssetReference['config']>().toEqualTypeOf<ModelAsset>()
    expectTypeOf<
      Awaited<ReturnType<App['recountAssets']>>['missing'][number]['references']
    >().toEqualTypeOf<AssetReference[]>()
  })

  it('accepts the services of passkeys and TOTP', () => {
    assertType<ApplicationConfig>({
      app: {
        name: 'Example',
        session: { modelClass: 'Session' },
        authentication: { credentials: { modelClass: 'Credential' } }
      },
      services: {
        passkeys: { domain: 'example.com', origins: ['https://example.com'] },
        totp: { secret: 'totp-secret' }
      }
    })
    assertType<Services>({ passkeys: PasskeyService, totp: TotpService })
    expectTypeOf<PasskeyService['config']>().toEqualTypeOf<{
      domain?: string
      origins?: string[]
    } | null>()
    expectTypeOf<TotpService['config']>().toEqualTypeOf<{
      secret: string
    } | null>()
  })

  it('declares the methods of the passkey and TOTP services', () => {
    type User = InstanceType<typeof UserModel>
    type Credential = InstanceType<typeof CredentialModel>
    const passkeys = {} as PasskeyService
    const totp = {} as TotpService
    const ctx = {} as KoaContext
    const user = {} as User
    expectTypeOf(passkeys.createAuthenticationOptions(ctx)).toEqualTypeOf<
      Promise<Record<string, unknown>>
    >()
    expectTypeOf(
      passkeys.verifyAuthentication(ctx, {}, {} as Credential)
    ).toEqualTypeOf<Promise<void>>()
    expectTypeOf(
      passkeys.createRegistrationOptions(ctx, user, [])
    ).toEqualTypeOf<Promise<Record<string, unknown>>>()
    expectTypeOf(passkeys.verifyRegistration(ctx, {})).toEqualTypeOf<
      Promise<{
        key: string
        name: string
        data: Record<string, unknown>
      }>
    >()
    expectTypeOf(totp.createSecret(ctx, user)).toEqualTypeOf<{
      uri: string
      secret: string
    }>()
    expectTypeOf(totp.confirmSecret(ctx, user, '123456')).toEqualTypeOf<
      Promise<string[]>
    >()
    expectTypeOf(totp.verifyCode(ctx, user, '123456')).toEqualTypeOf<
      Promise<void>
    >()
  })

  it('accepts a password reset in app.authentication', () => {
    assertType<ApplicationConfig>({
      app: {
        keys: ['test-secret'],
        authentication: {
          passwordReset: {
            confirmUrl: 'https://example.com/admin/#password-reset={token}',
            expiresAfter: '30m'
          }
        }
      }
    })
  })

  it('accepts the confirmed access in app.authentication', () => {
    assertType<ApplicationConfig>({
      app: {
        authentication: { reconfirmAccessAfter: '5m' }
      }
    })
  })
})
