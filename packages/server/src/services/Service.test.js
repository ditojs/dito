import { vi } from 'vitest'
import { Application } from '../app/Application.js'
import { Service } from './Service.js'

class BookCatalogService extends Service {
  books = []

  async initialize() {
    this.books.push(...(this.config.initialBooks ?? []))
  }

  findBook(title) {
    return this.books.find(book => book.title === title) || null
  }
}

function createApp({ services, config } = {}) {
  return new Application({
    config: { log: { silent: true }, ...config },
    services
  })
}

describe('Service', () => {
  describe('constructor()', () => {
    it('derives a camel-cased name from the class name', () => {
      const service = new BookCatalogService({})
      expect(service.name).toBe('bookCatalog')
      expect(service.config).toBe(null)
      expect(service.initialized).toBe(false)
    })

    it('keeps class names without a `Service` suffix', () => {
      class Mailer extends Service {}
      expect(new Mailer({}).name).toBe('mailer')
    })

    it('prefers the passed name over the class name', () => {
      expect(new BookCatalogService({}, 'LibraryIndexService').name).toBe(
        'libraryIndex'
      )
      expect(new BookCatalogService({}, 'search-index').name).toBe(
        'searchIndex'
      )
    })

    it('allows overriding the name with a class field', () => {
      class LoanService extends Service {
        name = 'loans'
      }
      expect(new LoanService({}).name).toBe('loans')
    })
  })

  describe('setup()', () => {
    it('stores the config', () => {
      const service = new BookCatalogService(createApp())
      const config = { initialBooks: [] }
      service.setup(config)
      expect(service.config).toBe(config)
    })

    it('starts and stops the service with the application', async () => {
      const app = createApp()
      const service = new BookCatalogService(app)
      const start = vi.spyOn(service, 'start')
      const stop = vi.spyOn(service, 'stop')
      service.setup({})
      await app.emit('before:start')
      expect(start).toHaveBeenCalledTimes(1)
      expect(stop).not.toHaveBeenCalled()
      await app.emit('after:stop')
      expect(stop).toHaveBeenCalledTimes(1)
    })
  })

  it('provides default no-op lifecycle methods', async () => {
    const service = new Service({})
    await expect(service.initialize()).resolves.toBeUndefined()
    await expect(service.start()).resolves.toBeUndefined()
    await expect(service.stop()).resolves.toBeUndefined()
  })

  describe('logger', () => {
    it('creates a child logger named after the hyphenated service name', () => {
      const child = {}
      const app = { logger: { child: vi.fn(() => child) } }
      const service = new BookCatalogService(app)
      expect(service.logger).toBe(child)
      expect(app.logger.child).toHaveBeenCalledWith({ name: 'book-catalog' })
    })

    it('uses the name from the constructor, not later overrides', () => {
      const app = { logger: { child: vi.fn(options => options) } }
      class LoanService extends Service {
        name = 'loans'
      }
      expect(new LoanService(app).logger).toEqual({ name: 'loan' })
    })

    it('derives from the application logger', () => {
      const app = createApp()
      const service = new BookCatalogService(app)
      expect(service.logger.bindings()).toMatchObject({ name: 'book-catalog' })
    })
  })
})

describe('Application services', () => {
  it('instantiates service classes under their configured key', () => {
    const app = createApp({ services: { catalog: BookCatalogService } })
    const service = app.getService('catalog')
    expect(service).toBeInstanceOf(BookCatalogService)
    expect(service.app).toBe(app)
    expect(app.getService('bookCatalog')).toBe(null)
  })

  it('derives the name from module keys with a `Service` suffix', () => {
    const app = createApp({
      services: { BookCatalogService }
    })
    expect(app.getService('bookCatalog')).toBeInstanceOf(BookCatalogService)
  })

  it('accepts service instances', () => {
    const app = createApp()
    const service = new BookCatalogService(app, 'shelf')
    app.addService(service)
    expect(app.getService('shelf')).toBe(service)
    expect(app.findService(s => s instanceof BookCatalogService)).toBe(service)
    expect(app.findService(() => false)).toBe(null)
  })

  it('rejects invalid services', () => {
    const app = createApp()
    expect(() => app.addService({ name: 'fake' })).toThrow('Invalid service')
    expect(() => app.addService(class Fake {})).toThrow('Invalid service')
  })

  it('sets up and initializes services with their config', async () => {
    const app = createApp({
      services: { catalog: BookCatalogService },
      config: {
        services: { catalog: { initialBooks: [{ title: 'Moby Dick' }] } }
      }
    })
    await app.setupServices()
    const service = app.getService('catalog')
    expect(service.initialized).toBe(true)
    expect(service.findBook('Moby Dick')).toEqual({ title: 'Moby Dick' })
    expect(service.findBook('Ulysses')).toBe(null)
  })

  it('only initializes services once', async () => {
    const app = createApp({
      services: { catalog: BookCatalogService },
      config: { services: { catalog: {} } }
    })
    const service = app.getService('catalog')
    const initialize = vi.spyOn(service, 'initialize')
    await app.setupServices()
    await app.setupServices()
    expect(initialize).toHaveBeenCalledTimes(1)
  })

  it('removes services that are configured as `false`', async () => {
    const app = createApp({
      services: { catalog: BookCatalogService },
      config: { services: { catalog: false } }
    })
    await app.setupServices()
    expect(app.getService('catalog')).toBe(null)
  })

  it('throws when the configuration of a service is missing', async () => {
    const app = createApp({
      services: { catalog: BookCatalogService },
      config: { services: {} }
    })
    await expect(app.setupServices()).rejects.toThrow(
      `Configuration missing for service 'catalog'`
    )
  })
})
