import { vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { builtinModules } from 'module'
import { defineViteConfig } from './vite.js'

// Return the config object as-is instead of going through Vite:
const defineConfig = config => config

describe('defineViteConfig()', () => {
  let directory
  let cwd

  beforeEach(() => {
    // Externals are read from the package.json in the working directory.
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dito-vite-'))
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        name: 'shelf',
        dependencies: {
          'reading-list-for-tests': '^1.0.0',
          'book-covers-for-tests': '^1.0.0'
        }
      })
    )
    cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory)
  })

  afterEach(() => {
    cwd.mockRestore()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('creates a library build for the given name', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'book-shelf',
      minify: true
    })
    expect(config.build).toMatchObject({
      minify: true,
      sourcemap: false,
      cssCodeSplit: false,
      lib: {
        name: 'book-shelf',
        format: ['es', 'umd'],
        entry: './src/index.js',
        cssFileName: 'book-shelf'
      }
    })
    expect(config.build.lib.fileName('es')).toBe('book-shelf.es.js')
    expect(config.build.lib.fileName('umd')).toBe('book-shelf.umd.js')
    expect(config.esbuild).toEqual({ minify: true })
  })

  it('omits the vue plugin and css options by default', () => {
    const config = defineViteConfig({ defineConfig, name: 'book-shelf' })
    expect(config.plugins).toBe(null)
    expect(config.css).toBe(null)
  })

  it('adds the vue plugin when requested', () => {
    const config = defineViteConfig({ defineConfig, name: 'shelf', vue: true })
    expect(config.plugins).toHaveLength(1)
    expect(config.plugins[0].name).toBe('vite:vue')
  })

  it('adds postcss and scss options when css is requested', () => {
    const config = defineViteConfig({ defineConfig, name: 'shelf', css: true })
    expect(config.css.postcss.plugins).toHaveLength(1)
    expect(config.css.preprocessorOptions.scss.silenceDeprecations).toEqual([
      'import'
    ])
  })

  it('uses inline source maps for unminified builds', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'shelf',
      minify: false
    })
    expect(config.build.sourcemap).toBe('inline')
    expect(config.esbuild).toEqual({ minify: false })
  })

  it('respects an explicit sourcemap setting', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'shelf',
      minify: true,
      sourcemap: true
    })
    expect(config.build.sourcemap).toBe(true)
  })

  it('derives minify from the --watch argument by default', () => {
    const { argv } = process
    try {
      process.argv = [...argv, '--watch']
      expect(
        defineViteConfig({ defineConfig, name: 'shelf' }).build.minify
      ).toBe(false)
      process.argv = argv.filter(arg => arg !== '--watch')
      expect(
        defineViteConfig({ defineConfig, name: 'shelf' }).build.minify
      ).toBe(true)
    } finally {
      process.argv = argv
    }
  })

  it('marks builtins, included and dependency subpaths as external', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'shelf',
      externals: { include: ['@shelf/catalog'] }
    })
    const { external, output } = config.build.rollupOptions
    expect(external(builtinModules[0])).toBe(true)
    expect(external('@shelf/catalog')).toBe(true)
    expect(external('@shelf/catalog/authors')).toBe(true)
    expect(external('reading-list-for-tests')).toBe(true)
    expect(external('reading-list-for-tests/chapters')).toBe(true)
    expect(external('unlisted-package')).toBe(false)
    expect(external('./src/index.js')).toBe(false)
    expect(external('@ditojs/ui/src/index.js')).toBe(false)
    expect(output).toMatchObject({ exports: 'named', manualChunks: undefined })
    expect(output.globals('@shelf/catalog/authors')).toBe(
      '@shelf/catalog/authors'
    )
  })

  it('bundles excluded dependencies', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'shelf',
      externals: { exclude: ['book-covers-for-tests'] }
    })
    const { external } = config.build.rollupOptions
    expect(external('book-covers-for-tests')).toBe(false)
    expect(external('book-covers-for-tests/small')).toBe(false)
    expect(external('reading-list-for-tests')).toBe(true)
  })

  it('lets explicit includes win over excludes', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'shelf',
      externals: { include: ['@shelf/catalog'], exclude: ['@shelf/catalog'] }
    })
    expect(config.build.rollupOptions.external('@shelf/catalog')).toBe(true)
  })

  it('skips all build options when build is false', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'shelf',
      build: false
    })
    expect(config.build).toBe(null)
    expect(config.esbuild).toBe(null)
  })

  it('passes additional options through', () => {
    const config = defineViteConfig({
      defineConfig,
      name: 'shelf',
      server: { port: 4000 },
      resolve: { alias: { '@': '/src' } }
    })
    expect(config.server).toEqual({ port: 4000 })
    expect(config.resolve).toEqual({ alias: { '@': '/src' } })
  })

  it('uses vite defineConfig() by default', () => {
    const config = defineViteConfig()
    expect(config.build.lib.name).toBe(undefined)
    expect(config.build.rollupOptions.external('fs')).toBe(true)
  })
})
