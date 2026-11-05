# DitoAdmin

```js
import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

const admin = new DitoAdmin('#dito-admin', {
  views: {
    books: {
      type: 'view',
      label: 'Books',
      field: {
        type: 'list',
        resource: 'books',
        form: {
          type: 'form',
          fields: {
            title: { type: 'text', required: true },
            publishedAt: { type: 'date' }
          }
        }
      }
    }
  }
})
```

`DitoAdmin` creates the Vue application of the admin, mounts it to an element,
checks the server's session and, once a user is logged in, resolves the views
and their routes.

## Constructor

```js
new DitoAdmin(element, options)
```

### Parameters

| Name                               | Type                                         | Description                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `element`                          | `Element \| string`                          | The element to mount the admin to, or a selector for it.                                                                                                                                                                                                                                                                                                          |
| `options.views`                    | `Record<string, View> \| Promise \| () => …` | The top-level views and menus, keyed by name. Also a promise or a function returning them, e.g. a module namespace or a dynamic `import()`, or an array of modules that each export one named view. Resolved anew for each login. Default `{}`. See [Views](./schemas.md#view).                                                                                   |
| `options.api`                      | [`ApiConfig`](#apiconfig)                    | The API configuration, deep-merged over `dito.api`.                                                                                                                                                                                                                                                                                                               |
| `options.dito`                     | [`GlobalConfig`](#globalconfig)              | The global configuration. Defaults to `globalThis.dito`, which `createAdmin()` provides.                                                                                                                                                                                                                                                                          |
| `options.login.additionalFields`   | `Fields`                                     | Fields added to the login dialog after `username` and `password`. Their values are sent with the credentials.                                                                                                                                                                                                                                                     |
| `options.login.redirectAfterLogin` | `string`                                     | A URL to load after a successful login, instead of resolving the views in place.                                                                                                                                                                                                                                                                                  |
| `options.spinner`                  | `{ size?: string, color?: string } \| null`  | Size and color of the loading spinner in the header. `null` hides it.                                                                                                                                                                                                                                                                                             |
| `options.account.settings`         | `Form \| Promise \| () => …`                 | The form of the account settings, which the account menu opens at `/account/settings`, to edit the logged-in user through `self` of the [users routes](#users). Also a promise or a function returning it, e.g. a dynamic `import()`. Its `label` is the view's label, default `'Settings'`. See [Account settings](../../guide/admin/views.md#account-settings). |

`login`, `spinner` and `account` are kept in [`admin.options`](#options).
Unknown options log a warning.

### Example

```js
const admin = new DitoAdmin(document.getElementById('dito-admin'), {
  api: {
    url: '/api',
    users: { path: 'users' },
    timeout: 30000
  },
  views: () => import('./views/index.js'),
  login: {
    additionalFields: {
      remember: { type: 'checkbox', label: 'Stay logged in' }
    }
  }
})
```

## Instance properties

### el

```ts
admin.el: Element
```

The element the admin is mounted to, also when a selector was passed.

### api

```ts
admin.api: Api
```

The [API configuration](#apiconfig) with its defaults, and the functions
[`request()`](#request) and [`getApiUrl()`](#getapiurl).

### context

```ts
admin.context: AdminContext
```

The [context of the admin](#admincontext): the logged-in user, the
session, the views, `showDialog()`, `confirm()`, `prompt()`, `alert()` and
`notify()`.

### app

```ts
admin.app: import('vue').App
```

The Vue application instance.

### options

```ts
admin.options: { login?, spinner?, account? }
```

The constructor options other than `dito`, `api` and `views`.

## ApiConfig

The configuration of the admin's API, passed as `options.api` and merged
deeply over `dito.api`. It is data: only `formats` and `defaults` hold
functions, which are set in `options.api`, as only data reaches the browser
through `dito.api`.

| Property           | Type                                                   | Default                                  | Description                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`              | `string`                                               |                                          | The base URL of all API requests. Relative request URLs are combined with it.                                                                                                               |
| `locale`           | `string`                                               | `'en-US'`                                | The locale of date, time and number formatting.                                                                                                                                             |
| `formats`          | `{ number?, date?, time? }`                            | `defaultFormats` of `@ditojs/utils`      | Default formats, merged over the defaults. Schemas override them per field.                                                                                                                 |
| `timeout`          | `number \| null`                                       | `null`                                   | Milliseconds after which requests are aborted. Requests can set their own.                                                                                                                  |
| `notifications`    | `boolean \| { durationFactor: number }`                | `true`                                   | `false` disables the notification toasts. `durationFactor` sets the display duration in milliseconds per character of the title and the rendered content, plus 40 characters, default `20`. |
| `cors.credentials` | `boolean`                                              |                                          | Sends credentials with cross-site requests to the API (`credentials: 'include'`).                                                                                                           |
| `headers`          | `Record<string, string>`                               | `{ 'Content-Type': 'application/json' }` | Headers of all API requests, merged over the default. Requests can override them.                                                                                                           |
| `users.path`       | `string`                                               |                                          | The path of the users routes, see [`users`](#users).                                                                                                                                        |
| `defaults`         | `Record<string, object \| (schema) => object \| void>` | `{}`                                     | Default schema options per schema type, see [`defaults`](#defaults).                                                                                                                        |

Only requests to the API receive `headers` and `cors.credentials`: relative
URLs, and absolute ones inside `api.url`.

The admin routes views and sources under their hyphenated names, such as
`/book-reviews` for a view named `bookReviews`, unless their schema sets a
`path`.

### users

```js
api: {
  users: { path: 'admins' }
}
```

`users.path` is the path of the controller of
[`usersRoutes()`](../server/auth.md#usersroutes). The admin logs in through
`POST admins/login`, logs out through `POST admins/logout` and loads the
logged-in user from `GET admins/self`, which returns `null` without one. It
reads `user` or `codeRequired` from the response of `login`. The admin offers
password changes, password resets, passkeys and TOTP when the server enables
them, see [`authentication`](#globalconfig). Their requests use the action
names of `usersRoutes()` under the same path, e.g. `POST admins/passkey-login`.
The [account settings](#parameters) load the user from `self` too and patch it
there, after which the admin fetches the user again. Requests that respond with
`confirmationRequired` ask for the password, the TOTP code or a passkey, post
them to `confirm-access` and are sent again. See [AdminContext](#session) for
the session that uses them. Without `users.path`, the routes are at the root
of the API.

### defaults

```js
api: {
  defaults: {
    'multiselect': { searchable: true },
    'tree-list': { draggable: true },
    'list': schema => {
      schema.paginate ??= 25
    }
  }
}
```

Default schema options per schema type. During schema setup, object
defaults of a matching type are the base of each schema: values that the
schema sets itself win, also inside nested objects, which are merged deeply.
A function receives the schema and either modifies it directly or returns
options that are applied over it, so it decides itself what to override, e.g.
to derive an option from others. Keys are type names like `'tree-list'`, or
their camel-cased forms like `treeList`, so a module can be passed as
`import * as defaults`. Only functions can change a schema's `type`, e.g. to
map a type name of your own to a built-in type.

### request()

```ts
api.request<T>(options): Promise<Response & { data: T }>
```

Performs an HTTP request with `fetch()`. It applies `getApiUrl()`, `headers`,
`cors` and `timeout`, parses JSON responses into `response.data`, and rejects
responses that aren't ok with an `ApiError` that has the fields of the JSON body,
e.g. `message`, `type`, `code`, `errors` and `confirmationRequired`, the
`status` of the response, and the `response` itself.

| Name              | Type                                         | Description                                      |
| ----------------- | -------------------------------------------- | ------------------------------------------------ |
| `options.url`     | `string`                                     | The URL, relative to `api.url` or absolute.      |
| `options.method`  | [`HttpMethod`](./types.md)                   | Default `'get'`.                                 |
| `options.data`    | `unknown`                                    | The body, sent as JSON.                          |
| `options.query`   | `Record<string, …> \| [string, …][] \| null` | Query parameters.                                |
| `options.headers` | `Record<string, string> \| null`             | Headers, merged over `api.headers` for API URLs. |
| `options.signal`  | `AbortSignal \| null`                        | Aborts the request.                              |
| `options.timeout` | `number \| null`                             | Default `api.timeout`.                           |

#### Return value

A promise of the `Response`, with the parsed JSON body as `data`.

#### Example

```js
const { data } = await admin.api.request({
  url: 'books',
  query: { order: 'title', limit: 10 }
})
```

Schema callbacks use [`context.request()`](./context.md) instead, which
resolves resources and tracks loading.

### getApiUrl()

```ts
api.getApiUrl({ url, query }): string
```

Returns the full URL of a request: `url` prefixed with `api.url` unless it's
absolute or already starts with it, and `query` appended, e.g. for `fetch()`
calls of the app's own, such as downloads.

## AdminContext

```js
const admin = new DitoAdmin('#dito-admin', { views })
const { user, session } = admin.context
```

The context of the admin, as `admin.context`. It holds the logged-in user, the
session that logs users in and out, the resolved views, and shows dialogs and
notifications outside of schemas. `user`, `views` and `flattenedViews` change
with each login and are reactive, so components and computed values that read
them update.

Inside schemas, [`SchemaContext`](./context.md) offers the user, views,
`showDialog()`, `confirm()`, `prompt()`, `alert()` and `notify()` too.

### Properties

#### api

```ts
admin.context.api: Api
```

The same object as [`admin.api`](#api). Read-only.

#### user

```ts
admin.context.user: AdminUser | null
```

The logged-in user as the session endpoint or the login returned it, or `null`
when logged out. Read-only; it changes through the [session](#session).

#### settings

```ts
admin.context.settings: object
```

The admin's global settings, from `dito.settings` (see
[GlobalConfig](#globalconfig)), or `{}`. Read-only.

| Property            | Type      | Description                                                                  |
| ------------------- | --------- | ---------------------------------------------------------------------------- |
| `rootClass`         | `string`  | A class added to the admin's root element.                                   |
| `forceDragFallback` | `boolean` | Sort items with the drag library's fallback instead of native drag and drop. |

`dito` is the constructor's option of that name, which defaults to
`window.dito`.

#### views

```ts
admin.context.views: Record<string, View>
```

The resolved top-level views and menus, keyed by name. Empty while logged out.

#### flattenedViews

```ts
admin.context.flattenedViews: Record<string, ViewSchema | PageSchema>
```

All views, with the items of menus flattened into one record, keyed by name.

### Methods

#### showDialog()

```ts
admin.context.showDialog(options): Promise<unknown>
```

Shows a modal dialog outside of schemas, e.g. from your own code around the
admin. Takes the same options and resolves the same way as
[`context.showDialog()`](./context.md#showdialog).

#### confirm(), prompt() and alert()

```ts
admin.context.confirm(message, { action }?): Promise<boolean>
admin.context.prompt(message, { action, value, type }?): Promise<unknown>
admin.context.alert(message, { action }?): Promise<void>
```

Show confirmations, prompts and alerts outside of schemas. They take the same
arguments and resolve the same way as
[`context.confirm()`](./context.md#confirm),
[`context.prompt()`](./context.md#prompt) and
[`context.alert()`](./context.md#alert).

#### notify()

```ts
admin.context.notify(options): void
```

Shows a notification toast outside of schemas. Takes the same options as
[`context.notify()`](./context.md#notify).

```js
admin.context.notify({ type: 'success', text: `Saved ${count} books.` })
```

### session

```ts
admin.context.session
```

Logs users in and out through the [`api.users`](#users)
resources. Logging in resolves the views anew, as they may depend on the
user; logging out clears them. Logging out or in as another user clears the
responses cached with `request({ cache: 'global' })`.

#### login()

```ts
session.login(): Promise<AdminUser | null>
```

Shows the login dialog and posts the credentials to `login` of the
[users routes](#users), or logs in with a passkey through `passkey-login`,
asking again after each failure, until it succeeds or the user cancels. When
the response has `codeRequired`, for users with TOTP, it asks for the code of
their authenticator app or a backup code, and posts it to `login-code`, asking
again after wrong codes, and for the password when the user cancels or the
login expires. With `authentication.hasPasswordReset`, it requests a password
reset instead when the user chooses Forgot? in the password field, and then
asks to log in again.
With `login.redirectAfterLogin`, a successful login loads that URL instead.

##### Return value

A promise of the logged-in user, or `null` if the user cancels.

#### logout()

```ts
session.logout(): Promise<boolean>
```

Logs out through `logout` of the [users routes](#users).

##### Return value

A promise of whether the server confirmed the logout. On `false`, the user
stays logged in.

##### Example

```js
if (await admin.context.session.logout()) {
  location.href = '/'
}
```

#### fetchUser()

```ts
session.fetchUser(): Promise<AdminUser | null>
```

Fetches the user of the server's session through `api.users.self`, and
sets it as the admin's user.

##### Return value

A promise of the user, or `null` without a session.

#### ensureUser()

```ts
session.ensureUser(): Promise<AdminUser | null>
```

Fetches the user of the server's session, and asks to log in if the session
expired.

##### Return value

A promise of the user, or `null` if the user cancels the login.

##### Example

```js
// In a button's click handler, before a request that needs a session:
async onClick({ request }) {
  if (await admin.context.session.ensureUser()) {
    await request({ method: 'post', url: 'books/import' })
  }
}
```

### AdminUser

The user objects of the admin hold the data that the server returns for the
user, with this method added:

#### hasRole()

```ts
user.hasRole(...roles: string[]): boolean
```

Whether the user's `roles` array contains any of the given roles.

##### Example

```js
const books = {
  type: 'list',
  resource: 'books',
  deletable: ({ user }) => user.hasRole('admin', 'editor')
}
```

## GlobalConfig

The global `dito` object, built from the options of
[`createAdmin()`](../server/admin-server.md#createadmin) and served as
`window.dito`.
`window.dito` is only the default of the constructor's `dito` option; the
admin reads the configuration from that option, and keeps its `settings` in
[`admin.context.settings`](#settings).

| Property                           | Type        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`                             | `string`    | The base path of the admin's routes, the `base` of `createAdmin()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `api`                              | `ApiConfig` | The API configuration, the `api` of `createAdmin()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `settings`                         | `object`    | The admin's global settings, see [`admin.context.settings`](#settings).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `authentication.hasPasswordChange` | `boolean`   | Set when the users controller at [`api.users`](#users) routes `'post password'`, which `usersRoutes()` always does. Lets the user change their password in the Security dialog of the account menu. The account menu only offers the Security dialog when `hasPasswordChange`, `hasPasskeys` or `hasTotp` is set.                                                                                                                                                                                                                                                                                                               |
| `authentication.hasPasskeys`       | `boolean`   | Set when the users controller at `api.users` routes the passkey actions, with [`passkeys()`](../server/auth.md#passkeys). Adds a Sign In with Passkey button to the login dialog. The Security dialog of the account menu lists the user's passkeys, named after their providers, and lets the user add and remove them. Needs the peer dependency `@simplewebauthn/browser`.                                                                                                                                                                                                                                                   |
| `authentication.hasTotp`           | `boolean`   | Set when the users controller at `api.users` routes the TOTP actions, with [`totp()`](../server/auth.md#totp). Lets the user turn two-factor authentication with TOTP on and off in the Security dialog of the account menu. Turning it on shows a QR code for the authenticator app, and the backup codes. Needs the peer dependency `lean-qr`. The login dialog asks for the code whenever the server requires one.                                                                                                                                                                                                           |
| `authentication.hasPasswordReset`  | `boolean`   | Set when the users controller at `api.users` routes the password reset actions, with [`passwordReset()`](../server/auth.md#passwordreset). Adds a Forgot? button to the password field of the login dialog. It asks for the username and posts it to `'post password-reset'`, and the server emails a link. The link opens the admin with `#password-reset=` and the token. The admin then asks for the new password and posts it with the token to `'post password-reset-confirm'`. If the server returns validation errors, it shows them and asks again. Then it removes the token from the URL and asks the user to log in. |

`authentication` is the `features` of
[`usersRoutes()`](../server/auth.md#usersroutes), which `createAdmin()` passes
on. Without it, the admin offers none of these features.
