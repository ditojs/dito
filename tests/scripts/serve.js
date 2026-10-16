// Starts the app of an e2e scenario as its tests do, to use it by hand, e.g.
// `pnpm -C tests serve account --port 8080`. Without a name, it lists the
// scenarios.
import fs from 'node:fs'
import path from 'node:path'
import { registerHooks } from 'node:module'
import { parseArgs } from 'node:util'

// Node strips the types of .ts files, but doesn't resolve their imports of .js
// files to the .ts files, as TypeScript and Playwright do:
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.endsWith('.js')) {
        return nextResolve(specifier.replace(/\.js$/, '.ts'), context)
      }
      throw err
    }
  }
})

const {
  values: { port },
  positionals: [name]
} = parseArgs({
  options: { port: { type: 'string', default: '8080' } },
  allowPositionals: true
})

// Scenarios are the e2e directories with fixtures from `defineScenario()`:
const e2eDir = path.resolve(import.meta.dirname, '../e2e')
const scenarios = {}
for (const entry of fs.readdirSync(e2eDir, { withFileTypes: true })) {
  const file = path.join(e2eDir, entry.name, 'fixtures.ts')
  if (fs.existsSync(file)) {
    // Fixtures that configure Playwright on import can't be loaded outside
    // of it, and aren't scenarios anyway:
    const { test } = await import(file).catch(() => ({}))
    if (test?.options) {
      scenarios[entry.name] = test.options
    }
  }
}

const options = scenarios[name]
if (options) {
  const { startScenario, teardownTestApp } =
    await import('../utils/fixture-app.ts')
  // Serve on `localhost`, as browsers only treat it and https as secure
  // contexts, e.g. for passkeys:
  const { app, url, reset } = await startScenario({
    ...options,
    config: {
      ...options.config,
      server: { host: 'localhost', port: +port }
    }
  })
  await reset()
  console.info(`Serving '${name}' at ${url}/admin/, stop with Ctrl+C.`)
  process.once('SIGINT', () => teardownTestApp(app))
} else {
  if (name) {
    console.error(`Unknown scenario: '${name}'.`)
    process.exitCode = 1
  }
  console.info(
    'Usage: pnpm -C tests serve <scenario> [--port <port>]\n\nScenarios:\n  ' +
    Object.keys(scenarios).join('\n  ')
  )
}
