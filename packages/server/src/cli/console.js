import repl from 'repl'
import path from 'path'
import fs from 'fs-extra'
import pico from 'picocolors'
import objection from 'objection'
import { isFunction, deindent } from '@ditojs/utils'

let started = false
let server = null

export default async function startConsole(app, config) {
  config = {
    quiet: false,
    prompt: 'dito > ',
    useColors: true,
    ignoreUndefined: true,
    ...config
  }

  if (started) {
    return server
  }
  started = true

  server = repl.start({ ...config, prompt: '' })
  server.pause()
  Object.assign(server.context, {
    app,
    objection,
    ...app.models
  })
  server.eval = wrapEval(server)

  server.defineCommand('usage', {
    help: 'Detailed Dito Console usage information',
    action() {
      displayUsage(app, config, true)
      this.displayPrompt()
    }
  })

  server.defineCommand('models', {
    help: 'Display available Dito models',
    action() {
      console.info(Object.keys(app.models).join(', '))
      this.displayPrompt()
    }
  })

  // Set up history file
  const historyFile = path.join(process.cwd(), '.console_history')
  try {
    await fs.stat(historyFile)
    const lines = await fs.readFile(historyFile)
    lines.toString().split('\n')
      .reverse()
      .slice(0, config.historySize)
      .filter(line => line.trim())
      .map(line => server.history.push(line))
  } catch (e) {
    console.info(deindent`
      Unable to REPL history file at ${historyFile}.
      A history file will be created on shutdown
    `)
  }

  await app.start()
  if (!config.quiet) {
    displayUsage(app, config)
  }
  server.setPrompt(config.prompt)
  server.resume()
  server.write('', { name: 'return' })
  return new Promise(resolve => {
    server.once('exit', async () => {
      try {
        await app.stop()
      } catch (err) {
        logError(err)
      }
      try {
        const lines = (server.history || [])
          .reverse()
          .filter(line => line.trim())
          .join('\n')
        await fs.writeFile(historyFile, lines)
      } catch (err) {
        logError(err)
      }
      resolve(true)
    })
  })
}

function displayUsage(app, config, details) {
  const modelHandleNames = Object.keys(app.models)
  console.info(deindent`

    ------------------------------------------------------------
    Dito Console

    Available references:
     - Dito app: ${pico.cyan('app')}
    ${
      modelHandleNames.length > 0
        ? ` - Dito models: ${
          modelHandleNames.map(m => pico.cyan(m)).join(', ')
        }`
        : ''
    }
  `)
  if (details) {
    console.info(deindent`
      Examples:

      ${config.prompt} user = User.where({ lastName: 'Doe' }).first()
      ${config.prompt} user.$patch({ firstName: 'Joe' })
      ${config.prompt} user.$comments.insert({ ... })
    `)
  }
  console.info('------------------------------------------------------------')
}

// Wraps the default eval with a handler that resolves promises
function wrapEval({ eval: defaultEval }) {
  return async function(code, context, file, cb) {
    return defaultEval.call(this, code, context, file, async (err, result) => {
      if (err || !(result && isFunction(result.then))) {
        return cb(err, result)
      }
      try {
        const resolved = await result
        // Replace any promises in the REPL context with the resolved promise.
        for (const key in context) {
          if (context[key] === result) {
            context[key] = resolved
          }
        }
        cb(null, resolved)
      } catch (error) {
        logError(error)
        cb() // Application errors are not REPL errors
      }
    })
  }
}

function logError(error) {
  console.info(`\x1b[31m${error}\x1b[0m`)
}
