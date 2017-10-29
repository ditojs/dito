import repl from 'repl'
import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import dedent from 'dedent'

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

  if (!config.quiet) {
    displayUsage(app, config)
  }

  server = repl.start({ ...config, prompt: '' })
  server.pause()
  Object.assign(server.context, {
    app,
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
      console.log(Object.keys(app.models).join(', ') + '\n')
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
    console.log(dedent`
      Unable to REPL history file at ${historyFile}.
      A history file will be created on shutdown`)
  }

  server.once('exit', async () => {
    try {
      await app.stop()
    } catch (e) {
      console.error(e)
    }
    try {
      const lines = (server.history || [])
        .reverse()
        .filter(line => line.trim())
        .join('\n')
      await fs.writeFile(historyFile, lines)
    } catch (e) {
      console.error(e)
    }
    process.exit()
  })

  await app.start()
  server.setPrompt(config.prompt)
  server.resume()
  server.write('', { name: 'return' })
  return server
}

function displayUsage(app, config, details) {
  const modelHandleNames = Object.keys(app.models)
  console.log(dedent`
    ------------------------------------------------------------
    Dito Console

    Available references:
     - Dito app: ${chalk.cyan('app')}
    ${
      modelHandleNames.length > 0
        ? ` - Dito models: ${
          modelHandleNames.map(m => chalk.cyan(m)).join(', ')
        }` : ''
    }`)
  if (details) {
    console.log(dedent`
      Examples:

      ${config.prompt} user = User.where({ lastName: 'Doe' }).first()
      ${config.prompt} user.$patch({ firstName: 'Joe' })
      ${config.prompt} user.$comments.insert({ ... })
    `)
  }
  console.log('------------------------------------------------------------')
}

// Wrap the default eval with a handler that resolves promises
function wrapEval({ eval: defaultEval }) {
  return function (code, context, file, cb) {
    return defaultEval.call(this, code, context, file, (err, result) => {
      if (!result || !result.then) {
        return cb(err, result)
      }

      result.then(resolved => {
        resolvePromises(result, resolved)
        cb(null, resolved)
      }).catch(err => {
        resolvePromises(result, err)
        this.outputStream.write('\x1b[31m' + err + '\x1b[0m')
        // Application errors are not REPL errors
        cb()
      })
    })

    function resolvePromises(promise, resolved) {
      Object.keys(context).forEach(key => {
        // Replace any promise handles in the REPL context with the resolved
        // promise
        if (context[key] === promise) {
          context[key] = resolved
        }
      })
    }
  }
}
