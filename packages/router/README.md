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

// match-any route
router.get('/books/*', ctx => {
  ctx.body = `sub-route: ${ctx.params['*']}`
})

// Handler found
let { handler, params } = router.find('get', '/users/233')
console.log(handler) // ctx => { ... }

// Entry not Found
let { handler, params } = router.find('get', '/photos/233')
console.log(handler) // null

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
