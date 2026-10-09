import { vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { stripVTControlCharacters } from 'util'
import objection from 'objection'

const { servers } = vi.hoisted(() => ({ servers: [] }))

vi.mock('node:repl', async () => {
  const { EventEmitter } = await import('events')
  return {
    default: {
      start: vi.fn(options => {
        const server = new EventEmitter()
        Object.assign(server, {
          options,
          context: {},
          history: [],
          commands: {},
          prompt: null,
          writes: [],
          pause: vi.fn(),
          resume: vi.fn(),
          displayPrompt: vi.fn(),
          setPrompt(prompt) {
            server.prompt = prompt
          },
          write(...args) {
            server.writes.push(args)
          },
          defineCommand(name, command) {
            server.commands[name] = command
          },
          // The default eval of the REPL, evaluating `code` with the context:
          eval(code, context, file, callback) {
            try {
              const result = new Function(
                ...Object.keys(context),
                `return (${code})`
              )(...Object.values(context))
              callback(null, result)
            } catch (err) {
              callback(err)
            }
          }
        })
        servers.push(server)
        return server
      })
    }
  }
})

let dir
let output

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-console-'))
  vi.spyOn(process, 'cwd').mockReturnValue(dir)
  output = []
  vi.spyOn(console, 'info').mockImplementation(message =>
    output.push(stripVTControlCharacters(String(message)))
  )
  servers.length = 0
  // `startConsole()` only starts once per module instance.
  vi.resetModules()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(dir, { recursive: true, force: true })
})

class Book {}
class Author {}

function createApp() {
  return {
    models: { Book, Author },
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {})
  }
}

async function startConsole(app, config) {
  const { default: startConsole } = await import('./console.js')
  const promise = startConsole(app, config)
  // Wait for the server to be resumed after the app was started.
  await vi.waitFor(() => {
    expect(servers[0]?.resume).toHaveBeenCalled()
  })
  return { server: servers[0], promise, startConsole }
}

function evaluate(server, code) {
  return new Promise((resolve, reject) => {
    server.eval(code, server.context, 'repl', (err, result) =>
      err ? reject(err) : resolve(result)
    )
  })
}

describe('startConsole()', () => {
  it('starts a REPL with the app and models in its context', async () => {
    const app = createApp()
    const { server } = await startConsole(app)
    expect(server.context).toEqual({ app, objection, Book, Author })
    expect(server.options).toMatchObject({
      prompt: '',
      useColors: true,
      ignoreUndefined: true
    })
    expect(server.prompt).toBe('dito > ')
    expect(server.pause).toHaveBeenCalled()
    expect(app.start).toHaveBeenCalledTimes(1)
    expect(output.join('\n')).toContain(' - Dito.js models: Book, Author')
  })

  it('only starts once and returns the existing server', async () => {
    const app = createApp()
    const { server, startConsole: start } = await startConsole(app)
    expect(await start(app)).toBe(server)
    expect(servers).toHaveLength(1)
    expect(app.start).toHaveBeenCalledTimes(1)
  })

  it('does not display the usage when quiet', async () => {
    const app = createApp()
    const { server } = await startConsole(app, {
      quiet: true,
      prompt: 'library > '
    })
    expect(output.join('\n')).not.toContain('Dito.js Console')
    expect(server.prompt).toBe('library > ')
  })

  it('omits the models in the usage without models', async () => {
    const app = { ...createApp(), models: {} }
    await startConsole(app)
    expect(output.join('\n')).not.toContain('Dito.js models')
  })

  it('defines commands to display the usage and the models', async () => {
    const { server } = await startConsole(createApp())
    output.length = 0
    server.commands.models.action.call(server)
    expect(output).toEqual(['Book, Author'])
    output.length = 0
    server.commands.usage.action.call(server)
    expect(output.join('\n')).toContain(`dito >  user = User.where(`)
    expect(server.displayPrompt).toHaveBeenCalledTimes(2)
  })

  describe('history', () => {
    it('loads the history file in reverse order', async () => {
      await fs.writeFile(
        path.join(dir, '.console_history'),
        'Book.query()\n\n  \nAuthor.query()'
      )
      const { server } = await startConsole(createApp())
      expect(server.history).toEqual(['Author.query()', 'Book.query()'])
    })

    it('limits the loaded history to the history size', async () => {
      await fs.writeFile(
        path.join(dir, '.console_history'),
        'one\ntwo\nthree'
      )
      const { server } = await startConsole(createApp(), { historySize: 2 })
      expect(server.history).toEqual(['three', 'two'])
    })

    it('reports a missing history file', async () => {
      await startConsole(createApp())
      expect(output[0]).toContain(
        `Unable to REPL history file at ${path.join(dir, '.console_history')}`
      )
    })

    it('stops the app and saves the history on exit', async () => {
      const app = createApp()
      const { server, promise } = await startConsole(app)
      server.history.unshift('Book.query()', 'Author.query()', ' ')
      server.emit('exit')
      expect(await promise).toBe(true)
      expect(app.stop).toHaveBeenCalledTimes(1)
      expect(
        await fs.readFile(path.join(dir, '.console_history'), 'utf8')
      ).toBe('Author.query()\nBook.query()')
    })

    it('logs errors when stopping the app and saving the history', async () => {
      const app = createApp()
      app.stop.mockRejectedValue(new Error('Cannot stop'))
      const { server, promise } = await startConsole(app)
      // A folder in place of the history file makes writing it fail:
      await fs.mkdir(path.join(dir, '.console_history'))
      server.emit('exit')
      expect(await promise).toBe(true)
      expect(output).toContain('Error: Cannot stop')
      expect(output.some(line => line.includes('EISDIR'))).toBe(true)
    })
  })

  describe('eval', () => {
    it('passes on synchronous results', async () => {
      const { server } = await startConsole(createApp())
      expect(await evaluate(server, '1 + 2')).toBe(3)
    })

    it('passes on evaluation errors', async () => {
      const { server } = await startConsole(createApp())
      await expect(evaluate(server, 'missing.value')).rejects.toThrow(
        ReferenceError
      )
    })

    it('resolves promises', async () => {
      const { server } = await startConsole(createApp())
      expect(await evaluate(server, 'Promise.resolve(42)')).toBe(42)
    })

    it('replaces context promises with their resolved values', async () => {
      const { server } = await startConsole(createApp())
      const promise = Promise.resolve(['Moby Dick'])
      server.context.books = promise
      expect(await evaluate(server, 'books')).toEqual(['Moby Dick'])
      expect(server.context.books).toEqual(['Moby Dick'])
    })

    it('logs rejected promises instead of passing them on', async () => {
      const { server } = await startConsole(createApp())
      const result = await evaluate(
        server,
        'Promise.reject(new Error("Not found"))'
      )
      expect(result).toBeUndefined()
      expect(output).toContain('Error: Not found')
    })
  })
})
