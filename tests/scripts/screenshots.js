// Runs the screenshot tests in the browser of the Playwright Docker image, so
// that they render the same on every machine and in CI. Arguments are passed
// on to `playwright test`, e.g. `--update-snapshots` to update the baselines.
import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { setTimeout as sleep } from 'node:timers/promises'

const require = createRequire(import.meta.url)
const { version } = require('@playwright/test/package.json')
const image = `mcr.microsoft.com/playwright:v${version}-noble`
const port = 3700
const endpoint = `ws://127.0.0.1:${port}/`

function startBrowserServer() {
  return execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--init',
      // The architecture of CI, emulated elsewhere, so that the screenshots
      // render the same everywhere.
      '--platform',
      'linux/amd64',
      '--publish',
      `127.0.0.1:${port}:${port}`,
      image,
      'npx',
      '-y',
      `playwright@${version}`,
      'run-server',
      '--port',
      `${port}`,
      '--host',
      '0.0.0.0'
    ],
    { encoding: 'utf8' }
  ).trim()
}

async function waitForBrowserServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await fetch(`http://127.0.0.1:${port}/`)
      return
    } catch {
      await sleep(500)
    }
  }
  throw new Error(`The browser server didn't start on port ${port}`)
}

function runTests() {
  return new Promise(resolve => {
    const child = spawn(
      'pnpm',
      ['exec', 'playwright', 'test', '--project=screenshots', ...args],
      {
        stdio: 'inherit',
        env: { ...process.env, SCREENSHOTS_WS_ENDPOINT: endpoint }
      }
    )
    child.on('exit', code => resolve(code ?? 1))
  })
}

const args = process.argv.slice(2)
const container = startBrowserServer()
const stopBrowserServer = () => {
  execFileSync('docker', ['stop', container], { stdio: 'ignore' })
}
process.on('SIGINT', () => {
  stopBrowserServer()
  process.exit(130)
})
let exitCode = 1
try {
  await waitForBrowserServer()
  exitCode = await runTests()
} finally {
  stopBrowserServer()
}
process.exit(exitCode)
