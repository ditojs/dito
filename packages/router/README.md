# Dito.js Router

Dito.js is a declarative and modern web framework with a focus on API driven
development, based on Koa.js, Objection.js and Vue.js

Released in 2018 under the MIT license, with support by https://lineto.com/

Dito.js Router is a high performance, tree-based, framework agnostic HTTP
router, based on [trek-router](https://github.com/trekjs/router), which in turn
is inspired by [Echo](https://github.com/labstack/echo)'s Router.

## How does it work?

The router relies on a tree structure which makes heavy use of common
prefixes, essentially a [prefix tree](https://en.wikipedia.org/wiki/Trie).

## Usage

```js
import Koa from 'koa'
import Router from '@ditojs/router'

const app = new Koa()
const router = new Router()

// static route
router.get('/folders/files/bolt.gif', ctx => {
  ctx.body = `this ain't no GIF!`
})

// param route
router.get('/users/:id', ctx => {
  ctx.body = `requesting user ${ctx.params.id}`
})

// wildcard routes: `*` matches one segment, `**` the rest of the path
router.get('/books/*', ctx => {
  ctx.body = `book: ${ctx.params.$}`
})
router.get('/files/**', ctx => {
  ctx.body = `file: ${ctx.params.$$}`
})

// Handler found, methods are uppercase
const { handler, params } = router.find('GET', '/users/233')
console.log(handler, params) // ctx => { ... } { id: '233' }

// Entry not found
const result = router.find('GET', '/photos/233')
console.log(result.handler, result.status) // undefined 404

// Install router middleware
app.use(async (ctx, next) => {
  const { method, path } = ctx
  const result = router.find(method, path)
  const { handler, params } = result
  if (handler) {
    ctx.params = params || {}
    return handler(ctx, next)
  } else {
    try {
      await next()
    } finally {
      if (ctx.body === undefined && ctx.status === 404) {
        ctx.status = result.status || 404
        if (ctx.status !== 404 && result.allowed) {
          ctx.set('Allow', result.allowed.join(', '))
        }
      }
    }
  }
})

app.listen(4040, () => console.log('Koa app listening on 4040'))
```

## Options

- `prefix`: is prepended to the paths of `add()` and `find()` alike, so
  `new Router({ prefix: '/api' })` routes `/api/users/:id` and finds it with
  `find('GET', '/users/233')`.
- `strict`: keeps trailing slashes and paths without a leading slash as they
  are, instead of normalizing them.
