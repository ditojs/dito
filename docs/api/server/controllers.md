# Controllers

```js
import {
  defineAction,
  defineController,
  defineMixin,
  isAuthorized
} from '@ditojs/server'
```

A controller is a plain object with a `path`, settings, and a map of `actions`
keyed `'verb path'`. A mixin is a controller without a `path`. It adds its
actions, settings and middleware to the controllers that list it. See
[Controllers](../../guide/server/controllers.md) in the guide.

Model controllers come from
[`defineModelController()` of `@ditojs/mikro`](mikro.md#definemodelcontroller).
They take the same options, and add their own, such as `serialize` and
`deserialize`.

## defineController()

```ts
defineController(definition: ControllerDefinition): ControllerDefinition
```

Returns the definition as it is, and only gives it its types. A plain object
with a string `path` works the same.

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

`actions` maps keys to actions. A key is the verb, then a space and the path
below the controller's path, if any:

- The verbs are `get`, `post`, `put`, `patch` and `delete`.
- Keys look like `get`, `post`, `get :id`, `post :id/publish` and
  `get by-name/:name`.
- A path that starts with `:id` is a record action. Its context holds the id in
  `params.id`. In [model controllers](mikro.md#variables), it also holds the
  converted id as `id`.
- `:id` is reserved for record actions.
- Paths use Hono's syntax. `:name` matches one segment, and `:name{.+}` matches
  one or more. Both become `params.name`.

The value of a key:

| Value                    | Meaning                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| a function               | The handler, which routes the key. Its `next()` runs the handler that it replaces, from a layer beneath.   |
| `true`                   | Routes the handler beneath, such as a mixin's or the default handler of a model controller.                |
| an object with `handler` | The handler, with its own settings and schemas, see [action objects](#action-objects).                     |
| an object without it     | Routes the handler beneath, and adds settings and schemas, such as `'patch :id': { authorize: 'editor' }`. |

A model controller routes the default handlers of the keys that it or its mixins
set, with `true` or with an object.

### Action objects

| Key          | Type                         | Description                                                                                                                       |
| ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `handler`    | [`Handler`](#handler)        | The handler. Without it, the action routes the handler beneath.                                                                   |
| `query`      | `z.ZodType`                  | Validates the query. Repeated parameters arrive as arrays. Its output becomes `query` of the context, and `c.req.valid('query')`. |
| `body`       | `z.ZodType`                  | Validates the JSON body. Its output becomes `body` of the context, and `c.req.valid('json')`.                                     |
| `authorize`  | [`authorize`](#authorize)    | Who may run the action.                                                                                                           |
| `middleware` | `Middleware \| Middleware[]` | Hono middleware of this action only, such as caching headers.                                                                     |
| `transacted` | `boolean`                    | Whether the action runs in a transaction.                                                                                         |

Schemas are [Zod](https://zod.dev) schemas. They run through `validator()` of
`hono/validator`. Invalid input responds with 400 and the issues of the schema,
see [Validation errors](errors.md#validation-errors).

## defineAction()

```ts
defineAction(definition)
```

```js
'post :id/publish': defineAction({
  body: z.object({ date: z.iso.datetime() }),
  handler: ({ body: { date }, params: { id } }) => publish(id, new Date(date))
})
```

Returns the [action object](#action-objects). In TypeScript, it types `query`
and `body` of the handler's context by the output of its schemas. It types
`c.req.valid('query')` and `c.req.valid('json')` the same way.

## Handler

```ts
type Handler = (context: HandlerContext) => unknown
```

```js
'get subscribe': defineAction({
  query: z.object({ emailAddress: z.email() }),
  handler: ({ query: { emailAddress } }) => subscribe(emailAddress)
})
```

A handler gets its [context](api.md#the-handlers-context) as one object,
`{ query, body, params, user, em, action, c, next }`. It destructures what it
needs. `next()` runs the handler that this one replaces, and returns its result.

A handler returns one of two things:

- data, which Dito sends as JSON;
- a `Response`, such as `c.text()` or `c.redirect()`, which Dito sends as it is.

The status and headers:

- Data responds with 200, and `undefined` with 204, unless `c.status()` sets
  another status.
- A `post` that creates a row sets 201 itself. The default `post` of
  [`@ditojs/mikro`](mikro.md) does this.
- `c.header()` adds headers to the data. It also adds them to a returned
  `Response`, unless the `Response` sets them itself.

## ActionSettings

The settings that actions, controllers and mixins share.

| Key          | Type                         | Description                                                                                                                                   |
| ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorize`  | [`authorize`](#authorize)    | Who may run the action.                                                                                                                       |
| `middleware` | `Middleware \| Middleware[]` | Joined in layer order, with the action's own last.                                                                                            |
| `transacted` | `boolean`                    | Writes run in the API's `transaction` unless this is `false`. Use `false` for actions that run their own. Reads run in one if this is `true`. |

A setting comes from the last definition of the action that sets it, in layer
order. Without one, it comes from the last layer that sets it. So a setting on
an action overrides every layer, also when the action is a mixin's.

A mixin with `actions` only counts as a layer for its own actions. So its
`authorize` and `transacted` don't reach the actions of the controller. A mixin
without `actions` holds settings for all actions. A mixin's `middleware` always
reaches all actions of the controller. A mixin that guards all actions with
`authorize` stops guarding the others once it has actions of its own. If no
other layer sets `authorize` for them, `createApi()` throws.

## authorize

```ts
authorize:
  | true
  | string
  | string[]
  | ((context: RequestContext) => boolean | Promise<boolean>)
```

- `true` lets anyone in.
- Roles grant access if `c.var.user.roles` holds any of them.
- A function gets the [`RequestContext`](api.md#the-handlers-context), so `c`,
  `user` and all other variables, and decides. Only `true` grants access.
- A function reads the id of a record action with `c.req.param('id')`.
- A function runs before the transaction and before the middleware of the
  layers. So it loads what it checks itself.

A denied request responds with 401 without a user, and with 403 with one.

Every action needs `authorize`, on itself or on a layer, reads included.
Otherwise, `createApi()` throws. Use `authorize: true` to let anyone in.

`isAuthorized(c, authorize)` resolves to whether `authorize` lets the user of
`c.var.user` in. `createApi()` and
[`createAdmin()`](../admin/server.md#createadmin) check with it. Apps can use it
too.

## Middleware

```ts
type Middleware = MiddlewareHandler<{ Variables: DitoVariables }>
```

Hono middleware, `async (c, next) => { ... }`, which reads Dito's variables from
`c.var`, such as `c.var.user` and `c.var.action`.

- Any Hono middleware works, also that of `hono/*` and of third parties.
- It runs before the handler, and calls `await next()`. It may return a
  `Response` of its own instead.
- The middleware of controllers, mixins and actions runs inside the transaction.
- It reads the body of a write from `c.var.body`. This is the same object that
  the handler gets.

## Mixins

A controller's layers are its mixins, then the controller itself:

- The mixins come depth-first and in order. Each mixin comes after the mixins
  that it lists.
- A mixin that several layers list is one layer, where it is first listed.
- A model controller puts its base, with the default handlers, beneath the
  mixins.

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

Hono's context of a Dito request, `c`. `c.var` holds the variables of
[`DitoVariables`](api.md#the-handlers-context). `c.req.valid('query')` and
`c.req.valid('json')` have the types of the action's schemas.

## Query values

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

Query values arrive as strings. Dito converts each value to what the schema
expects at its key. It does this before the `query` schema of an action
validates them, and before the schema of a list filter does:

| The schema expects     | Dito converts                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A number or an integer | `Number(value)`. The empty string stays a string, so the schema rejects it.                                                                             |
| A boolean              | `true` and `1` to `true`, `false` and `0` to `false`. Other values stay strings.                                                                        |
| A `Date`               | `new Date(value)`. Invalid dates stay strings.                                                                                                          |
| An array               | All values of a repeated key, `?a=1&a=2`, and a single value as an array of one. Each item is converted by the item's type. `.max()` limits the values. |
| A single value         | A repeated key responds with 400, at the key.                                                                                                           |

- Dito looks through `.optional()`, `.nullable()` and `.default()`.
- Unions, transforms, tuples and all other types get the strings as they are.
  Their schemas parse them, such as with `z.coerce.number()`.
- There are no comma-separated lists and no nested keys.
