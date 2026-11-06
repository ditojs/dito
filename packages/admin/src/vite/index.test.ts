import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { defineAdminViteConfig } from './index.ts'

describe('defineAdminViteConfig()', () => {
  const root = path.join(import.meta.dirname, '../test/admin-app')
  let dist: string

  beforeAll(async () => {
    dist = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-build-'))
    await build(
      await defineAdminViteConfig({
        root,
        base: '/admin',
        build: { outDir: dist },
        logLevel: 'silent'
      })
    )
  }, 30000)

  afterAll(() => fs.rm(dist, { recursive: true }))

  // Builds the admin of `root` into a folder of its own, and returns it.
  async function buildAdmin(root: string) {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-root-'))
    try {
      await build(
        await defineAdminViteConfig({
          root,
          base: '/admin',
          build: { outDir: path.join(folder, 'dist') },
          logLevel: 'silent'
        })
      )
      return await fs.readdir(path.join(folder, 'dist', 'views'))
    } finally {
      await fs.rm(folder, { recursive: true })
    }
  }

  it('builds the views into a chunk of their own', async () => {
    const files = await fs.readdir(path.join(dist, 'views'))
    expect(files).toEqual([expect.stringMatching(/^views-.*\.js$/)])
  })

  it('builds the views of a linked root into their chunk', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-link-'))
    const link = path.join(folder, 'admin')
    await fs.symlink(root, link)
    try {
      expect(await buildAdmin(link)).toEqual([
        expect.stringMatching(/^views-.*\.js$/)
      ])
    } finally {
      await fs.rm(folder, { recursive: true })
    }
  }, 30000)

  it('fails builds that give the views no chunk', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-admin-bare-'))
    await fs.cp(root, folder, { recursive: true })
    await fs.writeFile(path.join(folder, 'index.js'), 'export {}')
    try {
      await expect(buildAdmin(folder)).rejects.toThrow(
        'Unable to build the views into a chunk of their own'
      )
    } finally {
      await fs.rm(folder, { recursive: true })
    }
  }, 30000)

  // The fixture's entry and views share a module. The login loads before the
  // user may load the views, so the entry must not need their chunk.
  it('loads the views only when the admin imports them', async () => {
    const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8')
    expect(html).toContain('/admin/dito.js')
    expect(html).not.toMatch(/views-/)
    const assets = path.join(dist, 'assets')
    const files = await fs.readdir(assets)
    expect(files.some(file => file.endsWith('.js'))).toBe(true)
    for (const file of files.filter(file => file.endsWith('.js'))) {
      const code = await fs.readFile(path.join(assets, file), 'utf8')
      expect(code).not.toMatch(/^import[^;]*views-/m)
      expect(code).not.toMatch(/\bfrom\s*["']\.\.\/views\//)
    }
  })
})
