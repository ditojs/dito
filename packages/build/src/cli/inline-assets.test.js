import { vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const svg = name => (
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">' +
  `<title>${name}</title></svg>`
)

// Runs the CLI script in-process with the given arguments and returns what it
// writes to stdout.
async function runInlineAssets(args) {
  const { argv } = process
  const write = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true)
  try {
    process.argv = [argv[0], 'inline-assets', ...args]
    vi.resetModules()
    await import('./inline-assets.js')
    return write.mock.calls.map(([chunk]) => chunk).join('')
  } finally {
    process.argv = argv
    write.mockRestore()
  }
}

describe('inline-assets cli', () => {
  let directory
  let files

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dito-inline-'))
    files = ['book', 'shelf'].map(name => {
      const file = path.join(directory, `${name}.svg`)
      fs.writeFileSync(file, svg(name))
      return file
    })
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('prints names and data uris as json by default', async () => {
    const assets = JSON.parse(await runInlineAssets(files))
    expect(assets).toHaveLength(2)
    expect(assets.map(({ name }) => name)).toEqual(['book', 'shelf'])
    for (const asset of assets) {
      expect(Object.keys(asset)).toEqual(['name', 'data'])
      expect(asset.data).toMatch(/^data:image\/svg\+xml,/)
      expect(asset.data).toContain(asset.name)
    }
  })

  it('prints an empty json array without assets', async () => {
    expect(await runInlineAssets([])).toBe('[]')
  })

  it('renders assets through the default export of a template', async () => {
    const template = path.join(directory, 'template.js')
    fs.writeFileSync(
      template,
      `export default assets => assets
        .map(({ name, file, url }) =>
          \`\${name}|\${file}|\${url.slice(0, 24)}\`)
        .join('\\n')`
    )
    const output = await runInlineAssets([...files, '--template', template])
    expect(output.split('\n')).toEqual([
      `book|${files[0]}|url("data:image/svg+xml,`,
      `shelf|${files[1]}|url("data:image/svg+xml,`
    ])
  })

  it('resolves relative asset and template paths against the cwd', async () => {
    fs.writeFileSync(
      path.join(directory, 'names.js'),
      'export default assets => assets.map(({ name }) => name).join(",")'
    )
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory)
    try {
      expect(
        await runInlineAssets([
          'shelf.svg', 'book.svg', '--template', 'names.js'
        ])
      ).toBe('shelf,book')
    } finally {
      cwd.mockRestore()
    }
  })
})
