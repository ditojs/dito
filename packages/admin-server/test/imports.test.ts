import path from 'node:path'
import { getResolvedUrls } from '../../../tests/utils/imports.ts'

// Lists the modules that the main entry resolves in a new process.
function getLoadedModules(mode: 'production' | 'development') {
  const index = path.join(import.meta.dirname, '../src/serve-admin.ts')
  const root = path.join(import.meta.dirname, 'fixture')
  return getResolvedUrls(`
    const { serveAdmin } = await import(${JSON.stringify(index)})
    const admin = serveAdmin({
      base: '/admin',
      dist: ${JSON.stringify(root)},
      vite: ${JSON.stringify(mode)} === 'development'
        ? { root: ${
          JSON.stringify(root)
        }, configFile: false, logLevel: 'silent' }
        : undefined
    })
    if (${JSON.stringify(mode)} === 'production') {
      await admin.fetch(new Request('http://localhost/admin/index.html'))
    }
    await admin.close()
  `)
}

const isVite = (url: string) => /\/node_modules\/vite\//.test(url)

describe('the main entry', () => {
  it('loads no Vite in production', () => {
    const urls = getLoadedModules('production')
    expect(urls.some(url => url.endsWith('/src/serve-admin.ts'))).toBe(true)
    expect(urls.filter(isVite)).toEqual([])
    expect(urls.filter(url => /\/src\/vite-/.test(url))).toEqual([])
  })

  it('loads Vite in development', () => {
    expect(getLoadedModules('development').some(isVite)).toBe(true)
  }, 20000)
})
