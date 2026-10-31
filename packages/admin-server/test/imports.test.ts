import { execFileSync } from 'node:child_process'
import path from 'node:path'

// Runs the main entry in a fresh process and lists the modules it resolves.
function getLoadedModules(mode: 'production' | 'development') {
  const index = path.join(import.meta.dirname, '../src/index.ts')
  const root = path.join(import.meta.dirname, 'fixture')
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
    const { serveAdmin } = await import(${JSON.stringify(index)})
    const admin = serveAdmin({
      base: '/admin',
      mode: ${JSON.stringify(mode)},
      root: ${JSON.stringify(root)},
      dist: ${JSON.stringify(root)},
      vite: { configFile: false, logLevel: 'silent' }
    })
    await admin.fetch(new Request('http://localhost/admin/index.html'))
    await admin.close()
    console.log(JSON.stringify(urls))
  `
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { encoding: 'utf8' }
  )
  return JSON.parse(output) as string[]
}

const isVite = (url: string) => /\/node_modules\/vite\//.test(url)

describe('the main entry', () => {
  it('loads no Vite in production', () => {
    const urls = getLoadedModules('production')
    expect(urls.some(url => url.endsWith('/src/serve-admin.ts'))).toBe(true)
    expect(urls.filter(isVite)).toEqual([])
    expect(urls.filter(url => url.endsWith('/src/vite.ts'))).toEqual([])
  })

  it('loads Vite in development', () => {
    expect(getLoadedModules('development').some(isVite)).toBe(true)
  }, 20000)
})
