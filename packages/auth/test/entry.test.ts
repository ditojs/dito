import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Imports the main entry in a new Node process and lists the URLs that it
// resolves, to check that passkeys, TOTP and Koa's cookies load only from
// their subpaths.
function getLoadedUrls(entry: string) {
  const script = `
    import { registerHooks } from 'node:module'
    const urls = []
    registerHooks({
      resolve(specifier, context, next) {
        const result = next(specifier, context)
        urls.push(result.url)
        return result
      }
    })
    await import(${JSON.stringify(entry)})
    console.log(JSON.stringify(urls))
  `
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { encoding: 'utf8' }
  )
  return JSON.parse(output) as string[]
}

describe('main entry', () => {
  it('loads neither passkeys, TOTP nor Koa cookies', () => {
    const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url))
    const urls = getLoadedUrls(entry)
    expect(urls).toContainEqual(expect.stringMatching(/\/src\/sessions\.ts$/))
    for (const pattern of [
      /\/src\/(passkeys|totp|koa)\.ts$/,
      /\/(@simplewebauthn|otpauth|aaguids)\//
    ]) {
      expect(urls.filter(url => pattern.test(url))).toEqual([])
    }
  })
})
