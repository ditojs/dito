import repl from 'repl'
import chalk from 'chalk'
import setupHistory from './history'

const defaultConfig = {
  quiet: false,
  prompt: 'dito > ',
  useGlobal: true,
  ignoreUndefined: true
}

let started = false
let replServer = null
let context = null

export default async function startConsole(app, config) {
  if (started) {
    return replServer
  }
  started = true

  config = {
    ...defaultConfig,
    ...config
  }
  context = {
    app,
    ...app.models
  }

  if (!config.quiet) {
    console.log(usage(app, config))
  }

  replServer = repl.start(config)
  Object.assign(replServer.context, context)
  replServer.eval = wrapReplEval(replServer)

  replServer.defineCommand('usage', {
    help: 'Detailed Dito Console usage information',
    action() {
      this.outputStream.write(usage(app, config, true))
      this.displayPrompt()
    }
  })

  replServer.defineCommand('models', {
    help: 'Display available Dito models',
    action() {
      this.outputStream.write(Object.keys(app.models).join(', ') + '\n')
      this.displayPrompt()
    }
  })

  replServer.on('exit', function () {
    if (replServer._flushing) {
      replServer.pause()
      replServer.once('flushHistory', function () {
        process.exit()
      })
    } else {
      process.exit()
    }
  })

  return setupHistory(replServer, config.historyPath)
}

function usage(app, config, details) {
  const modelHandleNames = Object.keys(app.models)
  let usage = `
------------------------------------------------------------
Dito Console

Available objects:
 - Dito app: ${chalk.cyan('app')}
${
  modelHandleNames.length > 0
    ? ` - Dito models: ${
      modelHandleNames.map(m => chalk.cyan(m)).join(', ')
    }` : ''
}`
  if (details) {
    usage += `

Examples:
${config.prompt} user = User.where({ lastName: \'Doe\' }).first()
${config.prompt} user.$patch({ firstName: \'Joe\' })
${config.prompt} user.$comments.insert({ ... })`
  }
  usage += `
------------------------------------------------------------
`
  return usage
}

// Wrap the default eval with a handler that resolves promises
function wrapReplEval({ eval: defaultEval }) {
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
        console.log('\x1b[31m' + err + '\x1b[0m')
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
