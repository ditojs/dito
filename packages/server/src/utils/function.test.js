import { describeFunction } from './function.js'

describe('describeFunction()', () => {
  it('describes normal functions', () => {
    expect(
      describeFunction(function (a, b, c) {
        return a + b + c
      })
    )
      .toBe('function (a, b, c) { ... }')
  })

  it('describes lambdas with one param and a body', () => {
    expect(
      describeFunction(a => {
        return a
      })
    )
      .toBe('a => { ... }')
  })

  it('describes lambdas with one param and no body', () => {
    expect(describeFunction(a => a))
      .toBe('a => ...')
  })

  it('describes lambdas with multiple params and a body', () => {
    expect(
      describeFunction((a, b, c) => {
        return a + b + c
      })
    )
      .toBe('(a, b, c) => { ... }')
  })

  it('describes lambdas with multiple params and no body', () => {
    expect(describeFunction((a, b, c) => a + b + c))
      .toBe('(a, b, c) => ...')
  })

  it('describes async functions', () => {
    expect(
      describeFunction(async function (a, b, c) {
        return a + b + c
      })
    )
      .toBe('async function (a, b, c) { ... }')
  })

  it('describes async lambdas with one param and a body', () => {
    expect(
      describeFunction(async a => {
        return a
      })
    )
      .toBe('async a => { ... }')
  })

  it('describes async lambdas with one param and no body', () => {
    expect(describeFunction(async a => a))
      .toBe('async a => ...')
  })

  it('describes async lambdas with multiple params and a body', () => {
    expect(
      describeFunction(async (a, b, c) => {
        return a + b + c
      })
    )
      .toBe('async (a, b, c) => { ... }')
  })

  it('describes async lambdas with multiple params and no body', () => {
    expect(describeFunction(async (a, b, c) => a + b + c))
      .toBe('async (a, b, c) => ...')
  })

  it('omits the name of named functions', () => {
    expect(
      describeFunction(function listBooks(shelf) {
        return shelf
      })
    )
      .toBe('function (shelf) { ... }')
  })

  it('describes lambdas without params', () => {
    expect(describeFunction(() => 1))
      .toBe('() => ...')
  })

  it('returns undefined for method shorthands and classes', () => {
    const object = {
      list(shelf) {
        return shelf
      }
    }
    expect(describeFunction(object.list)).toBeUndefined()
    expect(describeFunction(class Shelf {})).toBeUndefined()
  })
})
