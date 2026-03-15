import fs from 'fs'
import path from 'path'
import {
  test, expect, fixturesDir
} from '../fixtures.js'
import { AssetFile } from '@ditojs/server'

test(
  'C1: create AssetFile from Buffer',
  async () => {
    const data = fs.readFileSync(
      path.resolve(fixturesDir, 'tiny.png')
    )
    const file = AssetFile.create({
      name: 'test.png',
      data
    })

    // Key is uuid + .png extension
    expect(file.key).toMatch(
      /^[0-9a-f-]+\.png$/
    )
    expect(file.name).toBe('test.png')
    expect(file.type).toBe('image/png')
    expect(file.size).toBe(data.length)
  }
)

test(
  'C2: create AssetFile from data URI',
  async () => {
    const data = fs.readFileSync(
      path.resolve(fixturesDir, 'tiny.png')
    )
    const dataUri =
      `data:image/png;base64,${data.toString('base64')}`

    const file = AssetFile.create({
      name: 'test.png',
      data: dataUri
    })

    expect(file.type).toBe('image/png')
    expect(file.size).toBe(data.length)
    expect(file.key).toMatch(
      /^[0-9a-f-]+\.png$/
    )
  }
)

test(
  'C3: create AssetFile from string',
  async () => {
    const file = AssetFile.create({
      name: 'readme.txt',
      data: 'hello world'
    })

    expect(file.type).toBe('text/plain')
    expect(file.size).toBe(
      Buffer.byteLength('hello world')
    )
    expect(file.key).toMatch(
      /^[0-9a-f-]+\.txt$/
    )
  }
)

test(
  'C4: MIME detection priority chain',
  async () => {
    const data = Buffer.from('test data')

    // Explicit type wins
    const f1 = AssetFile.create({
      name: 'file.png',
      data,
      type: 'application/custom'
    })
    expect(f1.type).toBe('application/custom')

    // Fallback to mime.lookup(name)
    const f2 = AssetFile.create({
      name: 'file.jpg',
      data
    })
    expect(f2.type).toBe('image/jpeg')

    // Unknown extension falls back to
    // application/octet-stream
    const f3 = AssetFile.create({
      name: 'file.xyz123',
      data
    })
    expect(f3.type).toBe(
      'application/octet-stream'
    )
  }
)
