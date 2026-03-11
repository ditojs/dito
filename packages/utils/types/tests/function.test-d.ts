import { assertType, describe, expectTypeOf, it } from 'vitest'
import type {
  debounce,
  debounceAsync,
  toAsync,
  toCallback,
  toPromiseCallback
} from '../index.d.ts'

describe('debounce', () => {
  it('preserves original function signature', () => {
    const fn = {} as typeof debounce
    const original = (x: number, y: string) => x + y.length
    const debounced = fn(original, 100)
    expectTypeOf(debounced).not.toBeAny()
    expectTypeOf(debounced).toBeCallableWith(1, 'hello')
    expectTypeOf(debounced(1, 'a')).toBeNumber()
  })

  it('adds cancel method', () => {
    const fn = {} as typeof debounce
    const debounced = fn(() => {}, 100)
    expectTypeOf(debounced.cancel).not.toBeAny()
    expectTypeOf(debounced.cancel).toBeFunction()
    expectTypeOf(debounced.cancel()).toBeBoolean()
  })

  it('accepts options object', () => {
    const fn = {} as typeof debounce
    fn((x: number) => x, { delay: 100, immediate: true })
  })

  it('rejects wrong argument types', () => {
    const fn = {} as typeof debounce
    const debounced = fn((x: number) => x, 100)
    // @ts-expect-error - string not assignable to number
    debounced('wrong')
  })
})

describe('debounceAsync', () => {
  it('preserves async function signature', () => {
    const fn = {} as typeof debounceAsync
    const original = async (id: number) => ({
      id,
      name: 'test'
    })
    const debounced = fn(original, 200)
    expectTypeOf(debounced).not.toBeAny()
    expectTypeOf(debounced).toBeCallableWith(1)
    expectTypeOf(debounced(1))
      .resolves.toHaveProperty('name')
  })
})

describe('toAsync', () => {
  it('converts error-first callback to promise', () => {
    const fn = {} as typeof toAsync
    const readFile = (
      path: string,
      cb: (err: any, data: Buffer) => void
    ) => {}
    const asyncReadFile = fn(readFile)
    expectTypeOf(asyncReadFile).not.toBeAny()
    expectTypeOf(asyncReadFile).toBeCallableWith('test.txt')
    expectTypeOf(asyncReadFile('x'))
      .resolves.toEqualTypeOf<Buffer>()
  })

  it('converts void callback to promise', () => {
    const fn = {} as typeof toAsync
    const doThing = (cb: (err?: any) => void) => {}
    const asyncDoThing = fn(doThing)
    expectTypeOf(asyncDoThing).not.toBeAny()
    expectTypeOf(asyncDoThing())
      .resolves.toEqualTypeOf<void>()
  })

  it('handles multiple arguments', () => {
    const fn = {} as typeof toAsync
    const write = (
      path: string,
      data: string,
      cb: (err: any, written: number) => void
    ) => {}
    const asyncWrite = fn(write)
    expectTypeOf(asyncWrite).not.toBeAny()
    expectTypeOf(asyncWrite).toBeCallableWith('f', 'data')
    expectTypeOf(asyncWrite('f', 'd'))
      .resolves.toBeNumber()
  })
})

describe('toCallback', () => {
  it('converts async fn to callback style', () => {
    const fn = {} as typeof toCallback
    const asyncFn = async (x: number): Promise<string> => `${x}`
    const cbFn = fn(asyncFn)
    expectTypeOf(cbFn).not.toBeAny()
    expectTypeOf(cbFn).toBeCallableWith(
      42,
      (err: any, result: string) => {}
    )
  })

  it('handles void return', () => {
    const fn = {} as typeof toCallback
    const asyncFn = async (x: string): Promise<void> => {}
    const cbFn = fn(asyncFn)
    expectTypeOf(cbFn).not.toBeAny()
    expectTypeOf(cbFn).toBeCallableWith(
      'hello',
      (err: any) => {}
    )
  })
})

describe('toPromiseCallback', () => {
  it('returns callback matching resolve/reject types', () => {
    const fn = {} as typeof toPromiseCallback
    const cb = fn<string, Error>(
      value => {
        expectTypeOf(value).not.toBeAny()
        expectTypeOf(value).toBeString()
      },
      reason => {
        expectTypeOf(reason).not.toBeAny()
        expectTypeOf(reason).toEqualTypeOf<Error>()
      }
    )
    expectTypeOf(cb).not.toBeAny()
    expectTypeOf(cb).toBeCallableWith(
      new Error(),
      'result'
    )
  })
})
