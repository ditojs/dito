# DitoAdmin

```js
import DitoAdmin from '@ditojs/admin'
import '@ditojs/admin/style.css'

const admin = new DitoAdmin('#dito-admin', {
  views: {
    books: {
      type: 'view',
      label: 'Books',
      component: {
        type: 'list',
        resource: 'books',
        form: {
          type: 'form',
          components: {
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

| Name | Type | Description |
| ---- | ---- | ----------- |
| `element` | `Element \| string` | The element to mount the admin to, or a selector for it. |
| `options.views` | `Record<string, View> \| Promise \| () => …` | The top-level views and menus, keyed by name. Also a promise or a function returning them, e.g. a module namespace or a dynamic `import()`, or an array of modules that each export one named view. Resolved anew for each login. Default `{}`. See [Views](./schemas.md#view). |
| `options.api` | [`ApiConfig`](#apiconfig) | The API configuration, deep-merged over `dito.api`. |
| `options.dito` | [`GlobalConfig`](#globalconfig) | The global configuration. Defaults to `globalThis.dito`, which `AdminController` provides. |
| `options.login.additionalComponents` | `Components` | Components added to the login dialog after `username` and `password`. Their values are sent with the credentials. |
| `options.login.redirectAfterLogin` | `string` | A URL to load after a successful login, instead of resolving the views in place. |
| `options.spinner` | `{ size?: string, color?: string } \| null` | Size and color of the loading spinner in the header. `null` hides it. |
| `options.account.settings` | `Form \| Promise \| () => …` | The form of the account settings, which the account menu opens at `/account/settings`, to edit the logged-in user through [`api.users.self`](#users). Also a promise or a function returning it, e.g. a dynamic `import()`. Its `label` is the view's label, default `'Settings'`. See [Account settings](../../guide/admin/views.md#account-settings). |

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
    additionalComponents: {
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
admin.api: ApiConfig
```

The resolved [API configuration](#apiconfig), with all defaults and functions
filled in.

### context

```ts
admin.context: AdminContext
```

The [context of the admin](#admincontext): the logged-in user, the
session, the views, `showDialog()` and `notify()`.

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

The configuration of the admin's API layer, passed as `options.api` and merged
deeply over `dito.api`. Only data reaches the browser through `dito.api`, so
the function members are set in `options.api`.

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `url` | `string` | | The base URL of all API requests. Relative request URLs are combined with it. |
| `locale` | `string` | `'en-US'` | The locale of date, time and number formatting. |
| `formats` | `{ number?, date?, time? }` | `defaultFormats` of `@ditojs/utils` | Default formats, merged over the defaults. Schemas override them per component. |
| `timeout` | `number \| null` | `null` | Milliseconds after which requests are aborted. Requests can set their own. |
| `notifications` | `boolean \| { durationFactor: number }` | `true` | `false` disables the notification toasts. `durationFactor` sets the display duration in milliseconds per character of the title and the rendered content, plus 40 characters, default `20`. |
| `cors.credentials` | `boolean` | | Sends credentials with cross-site requests to the API (`credentials: 'include'`). |
| `headers` | `Record<string, string>` | `{ 'Content-Type': 'application/json' }` | Headers of all API requests, merged over the default. Requests can override them. |
| `normalizePaths` | `boolean` | `config.app.normalizePaths`, else `false` | Sets `normalizePath` to `hyphenate()` and `denormalizePath` to `camelize()`. |
| `normalizePath` | `(path: string) => string` | identity | Converts a camel-cased path segment to its URL form, for schema routes and upload paths. |
| `denormalizePath` | `(path: string) => string` | identity | Converts a URL path segment back to its camel-cased form. |
| `users` | `object` | | The authentication resources, see [`users`](#users). |
| `resources` | `Record<string, (resource) => string>` | | Handlers that resolve resource paths, merged over the built-in `any`, `default`, `collection`, `member` and `upload`. |
| `defaults` | `Record<string, object \| (schema) => object \| void>` | `{}` | Default schema options per component type, see [`defaults`](#defaults). |
| `request` | `RequestMethod` | `fetch()` wrapper | Performs requests, see [`request()`](#request). |
| `getApiUrl` | `({ url, query }) => string` | | Returns the full URL of a request: `url` prefixed with `api.url` unless it's absolute or already starts with it, and `query` appended. |
| `isApiUrl` | `(url: string) => boolean` | | Whether a URL goes to the API: relative URLs, and absolute ones inside `api.url`. Only API requests receive `headers` and `cors.credentials`. |

### users

```js
api: {
  users: {
    path: 'users',
    login: { path: 'login', method: 'post' },
    logout: { path: 'logout', method: 'post' },
    session: { path: 'session', method: 'get' },
    self: { path: 'self' }
  }
}
```

`users.path` is the collection of the user model; `users: 'users'` is short
for `users: { path: 'users' }`. `login`, `logout`, `session` and `self` are
resources nested under it, shown here with their defaults, so the admin logs
in through `POST users/login`. The server's `UsersController` provides them.
The admin reads `user` from the responses of `login` and `session`, and
`success` from the response of `logout`. The
[account settings](#parameters) load the logged-in user from `self` and patch
it there, after which the admin fetches the session's user again. See [AdminContext](#session) for
the session that uses them.

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

Default schema options per component type. During schema setup, object
defaults of a matching type are the base of each schema: values that the
schema sets itself win, also inside nested objects, which are merged deeply.
A function receives the schema and either modifies it directly or returns
options that are applied over it, so it decides itself what to override, e.g.
to derive an option from others. Keys are type names like `'tree-list'`, or
their camel-cased forms like `treeList`, so a module can be passed as
`import * as defaults`. Only functions can change a schema's `type`, e.g. to
map a type name of your own to a built-in type.

### resources

```js
api: {
  resources: {
    // Handle `{ type: 'archive', path: 'books' }` resources:
    archive(resource) {
      return `archive/${this.collection(resource)}`
    }
  }
}
```

Each handler receives a resource object and returns its path. `this` is the
`resources` object, so handlers can call each other. `any(resource)`
dispatches to the handler of `resource.type`, falling back to `default`,
which prefixes the path of `resource.parent`.

### request()

```ts
api.request<T>(options): Promise<Response & { data: T }>
```

Performs an HTTP request. The default is a `fetch()` wrapper that applies
`getApiUrl()`, `headers`, `cors` and `timeout`, parses JSON responses into
`response.data`, and rejects responses that aren't ok with an error whose
`response` holds the response. Replace it to route all requests of the admin
through another client.

| Name | Type | Description |
| ---- | ---- | ----------- |
| `options.url` | `string` | The URL, relative to `api.url` or absolute. |
| `options.method` | [`HttpMethod`](./types.md) | Default `'get'`. |
| `options.data` | `unknown` | The body, sent as JSON. |
| `options.query` | `Record<string, …> \| [string, …][] \| null` | Query parameters. |
| `options.headers` | `Record<string, string> \| null` | Headers, merged over `api.headers` for API URLs. |
| `options.signal` | `AbortSignal \| null` | Aborts the request. |
| `options.timeout` | `number \| null` | Default `api.timeout`. |

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
`showDialog()` and `notify()` too.

### Properties

#### api

```ts
admin.context.api: ApiConfig
```

The resolved [API configuration](#apiconfig). Read-only.

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

| Property | Type | Description |
| -------- | ---- | ----------- |
| `rootClass` | `string` | A class added to the admin's root element. |
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
admin.context.flattenedViews: Record<string, ViewSchema>
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

Shows the login dialog and posts the credentials to `api.users.login`, asking
again after each failure, until it succeeds or the user cancels. With
`login.redirectAfterLogin`, a successful login loads that URL instead.

##### Return value

A promise of the logged-in user, or `null` if the user cancels.

#### logout()

```ts
session.logout(): Promise<boolean>
```

Logs out through `api.users.logout`.

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

Fetches the user of the server's session through `api.users.session`, and
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

The global `dito` object, served by `AdminController` from
`config.admin` (see [Server API](../server/index.md)) as `window.dito`.
`window.dito` is only the default of the constructor's `dito` option; the
admin reads the configuration from that option, and keeps its `settings` in
[`admin.context.settings`](#settings).

| Property | Type | Description |
| -------- | ---- | ----------- |
| `base` | `string` | The base path of the admin's routes. |
| `api` | `ApiConfig` | The API configuration. `AdminController` sets `normalizePaths` from `config.app.normalizePaths` unless `config.admin.api` sets it. |
| `settings` | `object` | The admin's global settings, see [`admin.context.settings`](#settings). |
