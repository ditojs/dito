# @ditojs/router

```js
import Router from '@ditojs/router'
```

A fast, tree-based HTTP router, independent of any framework. The
[`Application`](./server/application.md) of `@ditojs/server` routes its
controllers with it, and takes another router with the same `add()` and
`find()` methods through its `router` option. The package has one entry
point, an ES module without TypeScript types.

```js
const router = new Router()

router.get('/books', listBooks)
router.get('/books/:id', getBook)
router.get('/books/:bookId/chapters/:id', getChapter)
router.get('/covers/**', serveCover)

const { handler, params } = router.find('GET', '/books/12/chapters/3')
// handler: getChapter, params: { bookId: '12', id: '3' }
```

## new Router()

```js
new Router({ prefix, strict } = {})
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `prefix` | – | A path prepended to all paths, of routes and of lookups alike. |
| `strict` | `false` | Uses paths as they are. Otherwise a trailing slash is removed, except from `'/'`, and a leading slash added if missing. |

## Route paths

| Segment | Matches | Param |
| ------- | ------- | ----- |
| `books` | The text itself. | – |
| `:id` | One segment, up to the next `/`. | `id` |
| `*` | One segment. | `$`, or `$0`, `$1`, … with several |
| `**` | One or more segments, also in the middle of a path: `/covers/**/large`. | `$$`, or `$$0`, `$$1`, … with several |

Static segments take precedence over params, and params over `**`. Of several
`**` routes that match, the one added first wins. A path ending in `/**`
doesn't match the path before it: `/covers/**` doesn't match `/covers`.

```js
router.get('/books/*/chapters/*', handler)
router.find('GET', '/books/12/chapters/3').params // { $0: '12', $1: '3' }

router.get('/covers/**', handler)
router.find('GET', '/covers/2026/orlando.jpg').params
// { $$: '2026/orlando.jpg' }
```

## Methods

### add()

```js
router.add(method, path, handler)
```

Adds a route for the HTTP method `method`, and returns the router. Methods are
case-sensitive: use upper case, as in `ctx.method` of Koa.

### Method shortcuts

```js
router.get(path, handler)
```

`get()`, `post()`, `put()`, `patch()`, `delete()`, `head()`, `options()`,
`trace()` and `connect()` are short for `router.add('GET', path, handler)`
and so on.

### all()

```js
router.all(path, handler)
```

Adds the route for all methods of Node's `http.METHODS`.

### find()

```js
router.find(method, path)
```

Looks up the route of `method` and `path`. When one is found, it returns
`{ handler, params, status: 200 }`. Otherwise it returns a result without
`handler`, with the `status` to respond with and the `allowed` methods:

| Case | `status` |
| ---- | -------- |
| `GET` | `404` |
| `OPTIONS` | `200` |
| Other methods with routes, but not for `path` | `405` |
| Methods without any routes | `501` |

`allowed` lists the other methods with a route for `path` if `method` has
routes, and all methods with routes if it has none.

```js
app.use(async (ctx, next) => {
  const result = router.find(ctx.method, ctx.path)
  if (result.handler) {
    ctx.params = result.params
    return result.handler(ctx, next)
  }
  ctx.status = result.status
  if (result.allowed.length > 0) {
    ctx.set('Allow', result.allowed.join(', '))
  }
})
```

### getAllowedMethods()

```js
router.getAllowedMethods(path = null, exclude = null)
```

Returns the methods that have a route for `path`, leaving out `exclude`.
Without `path`, returns all methods that have routes.

### normalizePath()

```js
router.normalizePath(path)
```

Returns `path` as the router uses it, with `prefix` and, unless `strict`, the
slashes normalized.

### toString()

```js
router.toString(method = 'GET')
```

Returns the route tree of `method` as text, for debugging.
