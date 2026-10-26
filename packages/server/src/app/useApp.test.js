import { Application, useApp } from './Application.js'

// The application instance is state of the module, which each test file
// gets afresh, so these tests run in order in a file of their own:
describe('useApp()', () => {
  const createApp = () => new Application({ config: { log: { silent: true } } })

  it('throws before an application was created', () => {
    expect(() => useApp()).toThrow(
      'Unable to use the application: none was created yet.'
    )
  })

  it('returns the application', () => {
    const app = createApp()
    expect(useApp()).toBe(app)
  })

  it('throws once multiple applications were created', () => {
    createApp()
    expect(() => useApp()).toThrow(
      'Unable to use the application: multiple were created.'
    )
  })
})
