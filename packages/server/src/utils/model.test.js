import { Readable } from 'stream'
import { convertModelsToJson } from './model.js'

function createModel(json) {
  return {
    $isObjectionModel: true,
    $toJson: () => ({ ...json, converted: true })
  }
}

describe('convertModelsToJson()', () => {
  it('converts models with `$toJson()`', () => {
    const book = createModel({ id: 1 })
    expect(convertModelsToJson(book)).toEqual({ id: 1, converted: true })
  })

  it('converts models nested in plain objects and arrays', () => {
    const result = convertModelsToJson({
      total: 2,
      results: [createModel({ id: 1 }), createModel({ id: 2 })],
      nested: { author: createModel({ id: 3 }) }
    })
    expect(result).toEqual({
      total: 2,
      results: [
        { id: 1, converted: true },
        { id: 2, converted: true }
      ],
      nested: { author: { id: 3, converted: true } }
    })
  })

  it('returns new plain objects and arrays', () => {
    const object = { list: [1, 2] }
    const result = convertModelsToJson(object)
    expect(result).toEqual(object)
    expect(result).not.toBe(object)
    expect(result.list).not.toBe(object.list)
  })

  it('leaves primitives and non-plain objects untouched', () => {
    const buffer = Buffer.from('data')
    const stream = Readable.from(['data'])
    const date = new Date()
    expect(convertModelsToJson(buffer)).toBe(buffer)
    expect(convertModelsToJson(stream)).toBe(stream)
    expect(convertModelsToJson(date)).toBe(date)
    expect(convertModelsToJson({ buffer }).buffer).toBe(buffer)
    for (const value of [null, undefined, 0, 'text', true]) {
      expect(convertModelsToJson(value)).toBe(value)
    }
  })

  it('does not convert the JSON returned by models again', () => {
    const inner = createModel({ id: 2 })
    const outer = {
      $isObjectionModel: true,
      $toJson: () => ({ id: 1, inner })
    }
    expect(convertModelsToJson(outer).inner).toBe(inner)
  })
})
