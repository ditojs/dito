import { assertType, describe, expectTypeOf, it } from 'vitest'
import type {
  default as DitoAdmin,
  ApiConfig,
  Form,
  HttpMethod,
  HTTPMethod,
  TypeDescriptor,
  View
} from '@ditojs/admin'
import { DitoAdmin as NamedDitoAdmin, defineType } from '@ditojs/admin'
import type { Entry } from './fixtures.ts'

describe('DitoAdmin', () => {
  it('constructor accepts element and views option', () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      document.body,
      {
        views: {
          entries: {
            type: 'view',
            field: {
              type: 'list',
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text' }
                }
              }
            }
          } satisfies View<Entry>
        }
      }
    ])
  })

  it('accepts no options, as the views default to none', () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>(['#app'])
    assertType<ConstructorParameters<typeof DitoAdmin>>(['#app', {}])
  })

  it('accepts views as an array of named views and view modules', () => {
    const books = {} as Promise<{ books: View<Entry> }>
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      {
        views: [
          () => books,
          { type: 'view', name: 'authors', field: { type: 'list' } }
        ]
      }
    ])
  })

  it('accepts the global config and the users resource', () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      {
        dito: {
          settings: { forceDragFallback: true },
          authentication: {
            hasPasskeys: true,
            hasTotp: true,
            hasPasswordChange: true,
            hasPasswordReset: true
          }
        },
        api: { users: { login: { path: 'sign-in' } } }
      }
    ])
  })

  it(`rejects paths of the authentication features' resources`, () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      {
        // @ts-expect-error: They use the action names of `UsersController`.
        api: { users: { passkeyLogin: { path: 'passkey-sign-in' } } }
      }
    ])
  })

  it('accepts the login and spinner options', () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      {
        login: { redirectAfterLogin: '/books' },
        spinner: null
      }
    ])
  })

  it('accepts the form of the account settings, also as a module', () => {
    const settings = {} as Promise<{ default: Form<Entry> }>
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      {
        api: { users: { path: 'users', self: { path: 'me' } } },
        account: {
          settings: { type: 'form', fields: { title: { type: 'text' } } }
        }
      }
    ])
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      { account: { settings: () => settings } }
    ])
  })

  it('rejects unknown options', () => {
    assertType<ConstructorParameters<typeof DitoAdmin>>([
      '#app',
      // @ts-expect-error - `catalog` is no option of `DitoAdmin`.
      { catalog: 'books' }
    ])
  })

  it('is also exported by name', () => {
    expectTypeOf(NamedDitoAdmin).toEqualTypeOf<typeof DitoAdmin>()
  })
})

describe('defineType()', () => {
  it('accepts descriptors and returns them', () => {
    expectTypeOf(
      defineType({
        type: 'rating',
        component: { template: '<span />' },
        defaultValue: 0,
        defaultExclude: ({ value }) => value === 0,
        getValidations: ({ schema }) => ({ range: [0, schema.max ?? 5] }),
        setupSchema: async ({ schema, api, name }) => {
          expectTypeOf(schema).toEqualTypeOf<Record<string, any>>()
          expectTypeOf(api).toEqualTypeOf<ApiConfig>()
          expectTypeOf(name).toBeString()
        }
      })
    ).toEqualTypeOf<TypeDescriptor>()
  })

  it('accepts several types', () => {
    defineType({ type: ['rating', 'stars'], component: {} })
  })

  it('accepts the flags of the type', () => {
    defineType({
      type: 'heading',
      component: {},
      hasLabel: ({ nested }) => !nested,
      ignoresMissingValue: true,
      treatsNullAsMissing: ({ schema }) => !!schema.nested,
      rendersLabel: true,
      resolvesValue: true,
      submitsData: false,
      hasEmbeddedForms: false
    })
  })

  it('requires the type and the component', () => {
    // @ts-expect-error - `component` is missing.
    defineType({ type: 'rating' })
  })

  it('accepts types that load options', () => {
    defineType({
      type: 'tags',
      component: {},
      getOptionsDataSchema: schema => schema.options
    })
  })

  it(`doesn't expose the members of dito's list types`, () => {
    defineType({
      type: 'rating',
      component: {},
      // @ts-expect-error - Only dito's own list types have a source type.
      sourceType: 'list'
    })
    expectTypeOf<TypeDescriptor>().not.toHaveProperty('getItemAdapter')
    expectTypeOf<TypeDescriptor>().not.toHaveProperty('getChildSourceSchemas')
    expectTypeOf<TypeDescriptor>().not.toHaveProperty('getPanelSchema')
  })
})

describe('HttpMethod', () => {
  it('keeps the deprecated name HTTPMethod', () => {
    expectTypeOf<HTTPMethod>().toEqualTypeOf<HttpMethod>()
  })
})
