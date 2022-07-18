import Router from './Router.js'
import { deindent, shuffle } from '@ditojs/utils'
import http from 'http'

describe('Router', () => {
  const handler = () => {}

  let router
  beforeEach(() => {
    router = new Router()
  })

  let result
  describe('API', () => {
    describe.each([
      'get', 'put', 'post', 'delete', 'head', 'patch', 'options', 'trace',
      'connect'
    ])(
      'supports %s() short-cut',
      method => {
        it('reports correct allowed methods', () => {
          router[method]('/', () => {})
          expect(router.getAllowedMethods()).toStrictEqual(
            [method.toUpperCase()]
          )
        })
      }
    )

    it('supports all() short-cut', () => {
      router.all('/', () => {})
      expect(router.getAllowedMethods()).toEqual(http.METHODS)
    })

    it('returns allowed methods', () => {
      router.add('GET', '/', () => {})
      expect(router.getAllowedMethods()).toStrictEqual(['GET'])
      expect(router.getAllowedMethods('/')).toStrictEqual(['GET'])
    })

    it('does not count routes without handlers for allowed methods', () => {
      router.add('GET', '/')
      expect(router.getAllowedMethods('/')).toStrictEqual([])
    })

    it('allows excluding methods when getting allowed methods', () => {
      router.add('GET', '/', () => {})
      router.add('POST', '/', () => {})
      expect(router.getAllowedMethods('/', 'GET')).toStrictEqual(['POST'])
    })

    it('normalizes paths', () => {
      expect(router.normalizePath('/')).toBe('/')
      expect(router.normalizePath('/no-trailing/')).toBe('/no-trailing')
      expect(router.normalizePath('/no/trailing/')).toBe('/no/trailing')
      expect(router.normalizePath('/some/trailing//')).toBe('/some/trailing/')
      expect(router.normalizePath('/some/trailing///')).toBe('/some/trailing//')
      expect(router.normalizePath('wacky-path')).toBe('/wacky-path')
      expect(router.normalizePath('//like-whatever')).toBe('//like-whatever')
    })
  })

  it('supports prefix for path normalization', () => {
    router = new Router({ prefix: '/bla' })
    expect(router.normalizePath('/')).toBe('/bla/')
    expect(router.normalizePath('/no-trailing/')).toBe('/bla/no-trailing')
    expect(router.normalizePath('wacky-path')).toBe('/bla/wacky-path')
    expect(router.normalizePath('//like-whatever')).toBe('/bla//like-whatever')
  })

  it('does not normalize paths in strict mode', () => {
    router = new Router({ strict: true })
    expect(router.normalizePath('/')).toBe('/')
    expect(router.normalizePath('/trailing/')).toBe('/trailing/')
    expect(router.normalizePath('/more/trailing//')).toBe('/more/trailing//')
    expect(router.normalizePath('/more/trailing///')).toBe('/more/trailing///')
    expect(router.normalizePath('wacky-path')).toBe('wacky-path')
    expect(router.normalizePath('//like-whatever')).toBe('//like-whatever')
  })

  it('returns empty string with no routes', () => {
    expect(router.toString()).toStrictEqual('')
  })

  it('handles static routes', () => {
    const getHandler = () => {}
    const putHandler = () => {}
    router.add('GET', '/folders/files/bolt.gif', getHandler)
    router.add('PUT', '/folders/files/bolt.gif', putHandler)

    expect(router.toString()).toBe(deindent`
      / children=1
      └── folders/files/bolt.gif getHandler() children=0
    `.trim())

    result = router.find('GET', '/folders/files/bolt.gif')
    expect(result.handler).toBe(getHandler)
    expect(result.status).toBe(200)

    result = router.find('GET', '/folders/files/bolt.hash.gif')
    expect(result.handler).toBeUndefined()
    expect(result.allowed).toStrictEqual([])
    expect(result.status).toBe(404)

    result = router.find('GET', '/folders/bolt .gif')
    expect(result.handler).toBeUndefined()
    expect(result.status).toBe(404)

    result = router.find('PUT', '/folders/files/bolt.gif')
    expect(result.handler).toBe(putHandler)
    expect(result.status).toBe(200)

    result = router.find('PUT', '/folders/files/bolt.hash.gif')
    expect(result.handler).toBeUndefined()
    expect(result.status).toBe(405)
    expect(result.allowed).toStrictEqual([])

    result = router.find('POST', '/folders/files/bolt.gif')
    expect(result.handler).toBeUndefined()
    expect(result.status).toBe(501)
    expect(result.allowed).toStrictEqual(['GET', 'PUT'])
  })

  it('handles match-any nodes (catch-all / wildcard)', () => {
    router.add('GET', '/static/*', handler)

    expect(router.toString()).toBe(deindent`
      / children=1
      └── static/ children=1
          └── * handler() children=0
    `.trim())

    result = router.find('GET', '/static')
    expect(result.handler).toBeUndefined()

    result = router.find('GET', '/static/*')
    expect(result.handler).toBe(handler)

    result = router.find('GET', '/static/js')
    expect(result.handler).toBe(handler)
    expect(result.params).toEqual({
      '*': 'js'
    })

    result = router.find('GET', '/static/css')
    expect(result.handler).toBe(handler)
    expect(result.params).toEqual({
      '*': 'css'
    })
  })

  it('handles resources', () => {
    createRoutes(router, [
      ['/', 'root'],
      ['/geocoder', 'geocoder'],
      ['/geocoder/new', 'newGeocoder'],
      ['/geocoder/notify', 'notifyGeocoder'],
      // ['/geocoder/nnn', 'nnnGeocoder'],
      ['/geocoder/edit', 'editGeocoder'],
      ['/geocoder/edit/email', 'editEmailGeocoder'],
      ['/geocoder/edit/:item', 'editItemGeocoder'],
      ['/geocoder/exchange', 'exchangeGeocoder'],
      ['/geocoder/exchange/email', 'exchangeEmailGeocoder'],
      ['/geocoder/exchange/:item', 'exchangeItemGeocoder'],
      ['/geocoder/:id/echo', 'echoGeocoder'],
      ['/geocoder/:action', 'actionGeocoder'],
      ['/geocoder/*', 'anyGeocoder']
    ])

    expect(router.toString()).toBe(deindent`
      / root() children=1
      └── geocoder geocoder() children=1
          └── / children=4
              ├── n children=2
              │   ├── ew newGeocoder() children=0
              │   └── otify notifyGeocoder() children=0
              ├── e children=2
              │   ├── dit editGeocoder() children=1
              │   │   └── / children=2
              │   │       ├── email editEmailGeocoder() children=0
              │   │       └── :item editItemGeocoder() children=0
              │   └── xchange exchangeGeocoder() children=1
              │       └── / children=2
              │           ├── email exchangeEmailGeocoder() children=0
              │           └── :item exchangeItemGeocoder() children=0
              ├── :action actionGeocoder() children=1
              │   └── /echo echoGeocoder() children=0
              └── * anyGeocoder() children=0
    `.trim())
    result = router.find('GET', '')
    expect(result.handler).not.toBeUndefined()
    expect(result.params).toEqual({})

    result = router.find('GET', '/')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('root')
    expect(result.params).toEqual({})

    result = router.find('GET', '/geocoder/delete')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('actionGeocoder')
    expect(result.params).toEqual({ action: 'delete' })

    result = router.find('GET', '/geocoder/delete/any')
    expect(result.handler.name).toBe('anyGeocoder')
    expect(result.params).toEqual({ '*': 'delete/any' })

    result = router.find('GET', '/geocoder/any/action')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('anyGeocoder')
    expect(result.params).toEqual({ '*': 'any/action' })

    result = router.find('GET', '/geocoder/exchange/trekjs')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('exchangeItemGeocoder')
    expect(result.params).toEqual({ item: 'trekjs' })

    result = router.find('GET', '/geocoder/exchange/trekjs/any')
    expect(result.handler.name).toBe('anyGeocoder')

    result = router.find('GET', '/geocoder/exchange/email')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('exchangeEmailGeocoder')

    result = router.find('GET', '/geocoder/exchange/email/any')
    expect(result.handler.name).toBe('anyGeocoder')

    result = router.find('GET', '/geocoder/exchange')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('exchangeGeocoder')

    result = router.find('GET', '/geocoder/edit/trekjs')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('editItemGeocoder')

    result = router.find('GET', '/geocoder/edit/email')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('editEmailGeocoder')

    result = router.find('GET', '/geocoder/edit/email/any')
    expect(result.handler.name).toBe('anyGeocoder')

    result = router.find('GET', '/geocoder/edit')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('editGeocoder')

    result = router.find('GET', '/geocoder/new')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('newGeocoder')

    result = router.find('GET', '/geocoder/nnn')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('actionGeocoder')

    result = router.find('GET', '/geocoder/new/any')
    expect(result.handler.name).toBe('anyGeocoder')

    result = router.find('GET', '/geocoder')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('geocoder')

    result = router.find('GET', '/geocoder//')
    expect(result.handler).toBeUndefined()

    result = router.find('GET', '/repos')
    expect(result.handler).toBeUndefined()
  })

  it('handles nested resources', () => {
    createRoutes(router, [
      ['/users', 'users'],
      ['/users/new', 'newUser'],
      ['/users/nnw', 'newUser'],
      ['/users/:id', 'user'],
      ['/users/:id/edit', 'editUser'],
      ['/users/:id/:hello/:good/:bad/ddd', 'editUser'],
      ['/users/:id/:action', 'actionUser'],
      ['/users/:userId/photos/:id', 'photo'],
      ['/users/:userId/books/:id', 'book'],
      ['/users/*', 'anyUser']
    ])

    expect(router.toString()).toBe(deindent`
      / children=1
      └── users users() children=1
          └── / children=3
              ├── n children=2
              │   ├── ew newUser() children=0
              │   └── nw newUser() children=0
              ├── :userId user() children=1
              │   └── / children=4
              │       ├── edit editUser() children=0
              │       ├── :action actionUser() children=1
              │       │   └── / children=1
              │       │       └── :good children=1
              │       │           └── / children=1
              │       │               └── :bad children=1
              │       │                   └── /ddd editUser() children=0
              │       ├── photos/ children=1
              │       │   └── :id photo() children=0
              │       └── books/ children=1
              │           └── :id book() children=0
              └── * anyUser() children=0
    `.trim())

    result = router.find('GET', '/users/610/books/987/edit')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('anyUser')
    expect(result.params).toEqual({ '*': '610/books/987/edit' })

    result = router.find('GET', '/users/610/books/987')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('book')
    expect(result.params).toEqual({ userId: '610', id: '987' })

    result = router.find('GET', '/users/610/photos')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('actionUser')
    expect(result.params).toEqual({ id: '610', action: 'photos' })

    result = router.find('GET', '/users/610/photos/1024')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('photo')
    expect(result.params).toEqual({ userId: '610', id: '1024' })

    result = router.find('GET', '/users/2323/delete')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('actionUser')
    expect(result.params).toEqual({ id: '2323', action: 'delete' })

    result = router.find('GET', '/users/377/edit')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('editUser')
    expect(result.params).toEqual({ id: '377' })

    result = router.find('GET', '/users/233')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('user')
    expect(result.params).toEqual({ id: '233' })

    result = router.find('GET', '/users/new/preview')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('actionUser')
    expect(result.params).toEqual({ id: 'new', action: 'preview' })

    result = router.find('GET', '/users/news')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('user')
    expect(result.params).toEqual({ id: 'news' })

    result = router.find('GET', '/users/new')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('newUser')

    result = router.find('GET', '/users')
    expect(result.handler).not.toBeUndefined()
    expect(result.handler.name).toBe('users')

    result = router.find('GET', '/user')
    expect(result.handler).toBeUndefined()

    result = router.find('GET', '/repos')
    expect(result.handler).toBeUndefined()
  })

  describe('handles multiple resources', () => {
    const routes = [
      ['/users', 'users'],
      ['/users/new', 'newUser'],
      ['/users/:id', 'user'],
      ['/users/:id/:action', 'actionUser'],
      ['/users/:id/edit', 'editUser'],
      ['/users/:id/change', 'changeUser'],
      ['/users/:id/event', 'eventUser'],
      ['/photos', 'photos'],
      ['/photos/new', 'newPhoto'],
      ['/photos/:id', 'photo'],
      ['/photos/:id/:action', 'actionPhoto'],
      ['/photos/:id/edit', 'editPhoto'],
      ['/photos/:id/change', 'changePhoto'],
      ['/photos/:id/event', 'eventPhoto'],
      ['/books', 'books'],
      ['/books/new', 'newBook'],
      ['/books/:id', 'book'],
      ['/books/:id/:action', 'actionBook'],
      ['/books/:id/edit', 'editBook'],
      ['/books/:id/change', 'changeBook'],
      ['/books/:id/event', 'eventBook']
    ]

    it('parses routes into the correct tree', () => {
      createRoutes(router, routes)
      expect(router.toString()).toBe(deindent`
        / children=3
        ├── users users() children=1
        │   └── / children=2
        │       ├── new newUser() children=0
        │       └── :id user() children=1
        │           └── / children=3
        │               ├── :action actionUser() children=0
        │               ├── e children=2
        │               │   ├── dit editUser() children=0
        │               │   └── vent eventUser() children=0
        │               └── change changeUser() children=0
        ├── photos photos() children=1
        │   └── / children=2
        │       ├── new newPhoto() children=0
        │       └── :id photo() children=1
        │           └── / children=3
        │               ├── :action actionPhoto() children=0
        │               ├── e children=2
        │               │   ├── dit editPhoto() children=0
        │               │   └── vent eventPhoto() children=0
        │               └── change changePhoto() children=0
        └── books books() children=1
            └── / children=2
                ├── new newBook() children=0
                └── :id book() children=1
                    └── / children=3
                        ├── :action actionBook() children=0
                        ├── e children=2
                        │   ├── dit editBook() children=0
                        │   └── vent eventBook() children=0
                        └── change changeBook() children=0
      `.trim())
    })

    it('results in expected parameters', () => {
      createRoutes(router, shuffle(routes))

      result = router.find('GET', '/books/377/change')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('changeBook')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/books/377/event')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('eventBook')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/books/377/edit')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('editBook')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/books/233')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('book')
      expect(result.params).toEqual({ id: '233' })

      result = router.find('GET', '/books/new')
      expect(result.handler.name).toBe('newBook')
      expect(result.handler).not.toBeUndefined()

      result = router.find('GET', '/books')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('books')

      result = router.find('GET', '/users/377/change')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('changeUser')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/users/377/event')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('eventUser')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/users/377/edit')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('editUser')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/users/233')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('user')
      expect(result.params).toEqual({ id: '233' })

      result = router.find('GET', '/users/new')
      expect(result.handler.name).toBe('newUser')
      expect(result.handler).not.toBeUndefined()

      result = router.find('GET', '/users')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('users')

      result = router.find('GET', '/photos/377/event')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('eventPhoto')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/photos/377/change')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('changePhoto')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/photos/377/edit')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('editPhoto')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/photos/233')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('photo')
      expect(result.params).toEqual({ id: '233' })

      result = router.find('GET', '/photos/new')
      expect(result.handler.name).toBe('newPhoto')
      expect(result.handler).not.toBeUndefined()

      result = router.find('GET', '/photos')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('photos')
    })
  })

  describe('handles namespaces', () => {
    const routes = [
      ['/admin/articles', 'articles'],
      ['/admin/articles/new', 'newArticle'],
      ['/admin/articles/:id', 'article'],
      ['/admin/articles/:id/edit', 'editArticle']
    ]

    it('parses routes into the correct tree', () => {
      createRoutes(router, routes)
      expect(router.toString()).toBe(deindent`
        / children=1
        └── admin/articles articles() children=1
            └── / children=2
                ├── new newArticle() children=0
                └── :id article() children=1
                    └── /edit editArticle() children=0
      `.trim())
    })

    it('results in expected parameters', () => {
      createRoutes(router, shuffle(routes))

      result = router.find('GET', '/admin/articles/377/edit')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('editArticle')
      expect(result.params).toEqual({ id: '377' })

      result = router.find('GET', '/admin/articles/233')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('article')
      expect(result.params).toEqual({ id: '233' })

      result = router.find('GET', '/admin/articles/new')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('newArticle')

      result = router.find('GET', '/admin/articles')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('articles')
    })
  })

  describe('handles multiple nested resources', () => {
    const routes = [
      ['/magazines/:mid/articles', 'articles'],
      ['/magazines/:mid/articles/new', 'newArticle'],
      ['/magazines/:mid/articles/:id', 'article'],
      ['/magazines/:mid/articles/:id/edit', 'editArticle'],
      ['/magazines/:m_id/photos', 'photos'],
      ['/magazines/:m_id/photos/new', 'newPhoto'],
      ['/magazines/:m_id/photos/:id', 'photo'],
      ['/magazines/:m_id/photos/:id/edit', 'editPhoto']
    ]

    it('parses routes into the correct tree', () => {
      createRoutes(router, routes)
      expect(router.toString()).toBe(deindent`
        / children=1
        └── magazines/ children=1
            └── :m_id children=1
                └── / children=2
                    ├── articles articles() children=1
                    │   └── / children=2
                    │       ├── new newArticle() children=0
                    │       └── :id article() children=1
                    │           └── /edit editArticle() children=0
                    └── photos photos() children=1
                        └── / children=2
                            ├── new newPhoto() children=0
                            └── :id photo() children=1
                                └── /edit editPhoto() children=0
      `.trim())
    })

    it('results in expected parameters', () => {
      createRoutes(router, shuffle(routes))

      result = router.find('GET', '/magazines/233/articles/377')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('article')
      expect(result.params).toEqual({ mid: '233', id: '377' })

      result = router.find('GET', '/magazines/233/articles/377/edit')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('editArticle')
      expect(result.params).toEqual({ mid: '233', id: '377' })

      result = router.find('GET', '/magazines/233/articles/new')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('newArticle')
      expect(result.params).toEqual({ mid: '233' })

      result = router.find('GET', '/magazines/233/articles')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('articles')
      expect(result.params).toEqual({ mid: '233' })

      result = router.find('GET', '/magazines/233/photos/377/edit')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('editPhoto')
      expect(result.params).toEqual({ m_id: '233', id: '377' })

      result = router.find('GET', '/magazines/233/photos/377')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('photo')
      expect(result.params).toEqual({ m_id: '233', id: '377' })

      result = router.find('GET', '/magazines/233/photos/new')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('newPhoto')
      expect(result.params).toEqual({ m_id: '233' })

      result = router.find('GET', '/magazines/233/photos')
      expect(result.handler).not.toBeUndefined()
      expect(result.handler.name).toBe('photos')
      expect(result.params).toEqual({ m_id: '233' })
    })
  })

  it('identifies unnamed handlers', () => {
    router.add('GET', '/function', function() {})
    router.add('GET', '/closure', () => {})
    expect(router.toString()).toBe(deindent`
      / children=2
      ├── function ƒ() children=0
      └── closure ƒ() children=0
    `.trim())
  })

  it(`deals with paths not starting with '/'`, () => {
    router.add('GET', '/users', () => {})
    router.add('GET', '/wacky-path', () => {})
    expect(router.toString()).toBe(deindent`
      / children=2
      ├── users ƒ() children=0
      └── wacky-path ƒ() children=0
    `.trim())
  })
})

function createFunc(name) {
  return (new Function(
    `return function ${name}(){}`
  ))()
}

function createRoutes(router, routes) {
  routes.forEach(([path, name]) => {
    router.add('GET', path, createFunc(name))
  })
}
