# Controllers

```js
import {
  defineAction,
  defineController,
  defineMixin,
  isAuthorized
} from '@ditojs/server'
```

A controller is a plain object with a `path`, a map of `actions` keyed
`'verb path'`, and settings. A mixin is a controller without a `path`. It adds
its actions, settings and middleware to the controllers that list it. See
[Controllers](../../guide/server/controllers.md) in the guide.

Model controllers, from [`defineModelController()` of
`@ditojs/mikro`](mikro.md#definemodelcontroller), take the same options and add
their own, such as `serialize` and `deserialize`.

## defineController()

```ts
defineController(definition: ControllerDefinition): ControllerDefinition
```

Returns the definition, tagged so that `createApi()` finds it in a module
namespace.

### ControllerDefinition

| Key          | Type                         | Description                                                                                                                                                                 |
| ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`       | `string`                     | The path below the API, such as `book-categories`, without leading, trailing or double slashes. It may hold parameters, such as `pages/:pageId/child-pages`, but not `:id`. |
| `actions`    | [`Actions`](#actions)        | The routes of the controller.                                                                                                                                               |
| `mixins`     | `MixinDefinition[]`          | The [mixins](#mixins) of the controller.                                                                                                                                    |
| `authorize`  | [`authorize`](#authorize)    | Who may run the actions.                                                                                                                                                    |
| `middleware` | `Middleware \| Middleware[]` | Hono middleware of every action of the controller.                                                                                                                          |
| `transacted` | `boolean`                    | See [ActionSettings](#actionsettings).                                                                                                                                      |

`authorize`, `middleware` and `transacted` are the
[action settings](#actionsettings).

## defineMixin()

```ts
defineMixin(definition: MixinDefinition): MixinDefinition
```

Returns the definition. A `MixinDefinition` has all keys of a
`ControllerDefinition` except `path`.

## Actions

`actions` maps keys to actions. A key is the verb, `get`, `post`, `put`, `patch`
or `delete`, then a space and the path below the controller's path, if any:
`get`, `post`, `get :id`, `post :id/publish`, `get by-name/:name`.

- A path that starts with `:id` is a member action. Its input holds the id in
  `params.id`, and in [model controllers](mikro.md#variables) the converted id
  as `id`. `:id` is reserved for member actions.
- Paths use Hono's syntax: `:name` matches one segment, and `:name{.+}` one or
  more. Both become `params.name`.

The value of a key:

| Value                    | Meaning                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| a function               | The handler, which routes the key. Its `next()` runs the handler that it replaces, from a layer beneath.   |
| `true`                   | Routes the handler beneath, such as a mixin's or the default handler of a model controller.                |
| an object with `handler` | The handler, with its own settings and schemas, see [action objects](#action-objects).                     |
| an object without it     | Routes the handler beneath, and adds settings and schemas, such as `'patch :id': { authorize: 'editor' }`. |

A model controller routes the default handlers of the keys that it or its mixins
set, with `true` or an object.

### Action objects

| Key          | Type                         | Description                                                                                                                     |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `handler`    | [`Handler`](#handler)        | The handler. Without it, the action routes the handler beneath.                                                                 |
| `query`      | `z.ZodType`                  | Validates the query. Repeated parameters arrive as arrays. Its output becomes `query` of the input, and `c.req.valid('query')`. |
| `body`       | `z.ZodType`                  | Validates the JSON body. Its output becomes `body` of the input, and `c.req.valid('json')`.                                     |
| `authorize`  | [`authorize`](#authorize)    | Who may run the action.                                                                                                         |
| `middleware` | `Middleware \| Middleware[]` | Hono middleware of this action only, such as caching headers.                                                                   |
| `transacted` | `boolean`                    | Whether the action runs in a transaction.                                                                                       |

Schemas are [Zod](https://zod.dev) schemas, which run through `validator()` of
`hono/validator`. Invalid input responds with 400 and the issues of the schema, see [Validation errors](errors.md#validation-errors).

## defineAction()

```ts
defineAction(definition)
```

Returns the [action object](#action-objects). In TypeScript, it types `query`
and `body` of the handler's input, and `c.req.valid('query' | 'json')`, from the
output of its schemas.

```js
'post :id/publish': defineAction({
  body: z.object({ date: z.iso.datetime() }),
  handler: ({ body: { date }, params: { id } }) => publish(id, new Date(date))
})
```

## Handler

```ts
type Handler = (input: HandlerInput) => unknown
```

A handler gets the [input](api.md#the-handlers-input) of the request,
`{ query, body, params, user, em, action, c, next }`, and destructures what it
needs. `c` is Hono's context. `next()` runs the handler that this one replaces,
and returns its result.

```js
'get subscribe': defineAction({
  query: z.object({ emailAddress: z.email() }),
  handler: ({ query: { emailAddress } }) => subscribe(emailAddress)
})
```

A handler returns data, which Dito sends as JSON, or a `Response`, such as
`c.text()` or `c.redirect()`, which Dito sends as it is. Data responds with 200
and `undefined` with 204, unless `c.status()` sets another status. A `post` that
creates a row sets 201 itself, as the default `post` of
[`@ditojs/mikro`](mikro.md) does. `c.header()` adds headers to the data, and to
a returned `Response` unless it sets them itself.

## ActionSettings

The settings that actions, controllers and mixins share.

| Key          | Type                         | Description                                                                                                                                   |
| ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorize`  | [`authorize`](#authorize)    | Who may run the action.                                                                                                                       |
| `middleware` | `Middleware \| Middleware[]` | Joined in layer order, with the action's own last.                                                                                            |
| `transacted` | `boolean`                    | Writes run in the API's `transaction` unless this is `false`. Use `false` for actions that run their own. Reads run in one if this is `true`. |

A setting comes from the last definition of the action that sets it, in layer
order. Without one, it comes from the last layer that sets it. So a setting on
an action, also on a mixin's action, overrides every layer. A mixin with
`actions` only counts as a layer for its own actions, so its `authorize` and
`transacted` don't reach the actions of the controller. A mixin without
`actions` holds settings for all of them.

## authorize

```ts
authorize:
  | true
  | string
  | string[]
  | ((c: DitoContext) => boolean | Promise<boolean>)
```

- `true` lets anyone in.
- Roles grant access if `c.var.user.roles` holds any of them.
- A function of Hono's context decides, and only `true` grants access. It reads
  the id of a member action with
  `c.req.param('id')`. It runs before the transaction and the middleware of the
  layers, so it loads what it checks itself.

A denied request responds with 401 without a user, and with 403 with one.

Every write action needs `authorize` on itself or on a layer. Otherwise,
`createApi()` throws. Use `authorize: true` to open a write to anyone. GET
actions without `authorize` let anyone in.

`isAuthorized(c, authorize)` resolves to whether `authorize` lets the user of
`c.var.user` in. `createApi()` and
[`createAdmin()`](../admin/server.md#createadmin) check with it, and apps can too.

## Middleware

```ts
type Middleware = MiddlewareHandler<{ Variables: DitoVariables }>
```

Hono middleware, `async (c, next) => { ... }`, which reads Dito's variables from
`c.var`, such as `c.var.user` and `c.var.action`. Any Hono middleware works,
also that of `hono/*` and third parties. It runs before the handler, calls
`await next()`, and may return a `Response` of its own instead. The middleware
of controllers, mixins and actions runs inside the transaction. It reads the
body of a write from `c.var.body`, the same object that the handler gets.

## Mixins

A controller's layers are its mixins, depth-first and in order, each after the
mixins that it lists, and then the controller. A mixin that several layers list
is one layer, where it is first listed. A model controller puts its base, with
the default handlers, before the mixins.

In `actions`, each layer applies the rules of [Actions](#actions) on top of the
layers beneath it. When several layers set a key, each handler replaces the one
of the layer before, and runs it as `next()`. `middleware` lists join in layer
order.

## DitoContext

```ts
type DitoContext<Query, Body> = Context<
  { Variables: DitoVariables },
  any,
  { out: { query: Query; json: Body } }
>
```

Hono's context of a Dito request, `c`, with the variables of
[`DitoVariables`](api.md#the-handlers-input) in `c.var`. `c.req.valid('query')`
and `c.req.valid('json')` have the types of the action's schemas.

## Query values

Query values arrive as strings. Before the `query` schema of an action, or the
schema of a list filter, validates them, Dito converts each value to what the
schema expects at its key:

| The schema expects     | Dito converts                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A number or an integer | `Number(value)`. The empty string stays a string, so the schema rejects it.                                                                             |
| A boolean              | `true` and `1` to `true`, `false` and `0` to `false`. Other values stay strings.                                                                        |
| A `Date`               | `new Date(value)`. Invalid dates stay strings.                                                                                                          |
| An array               | All values of a repeated key, `?a=1&a=2`, and a single value as an array of one. Each item is converted by the item's type. `.max()` limits the values. |
| A single value         | A repeated key responds with 400, at the key.                                                                                                           |

Dito looks through `.optional()`, `.nullable()` and `.default()`. Unions,
transforms, tuples and all other types get the strings as they are, so their
schemas parse them themselves, such as with `z.coerce.number()`. There are no
comma-separated lists and no nested keys.

```js
'get search': defineAction({
  query: z.object({
    term: z.string(),
    limit: z.number().int().default(20),
    published: z.boolean().optional(),
    tags: z.array(z.string()).max(10).optional()
  }),
  handler: ({ em, query: { term, limit } }) => search(em, term, limit)
})
```
