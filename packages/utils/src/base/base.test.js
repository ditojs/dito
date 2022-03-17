import {
  isPlainObject, isObject, isArray, isModule, isFunction, isString, isBoolean,
  isNumber, isDate, isRegExp, isPromise, isAsync, isInteger, isArrayLike,
  isEmpty, asObject, asArray, asFunction
} from './base.js'

import * as module from './index.js'

const object = { a: 1 }
const array = [1, 2, 3]
const string = 'a'
const number = 1
const boolean = true
const date = new Date()
const regexp = /x/
const symbol = Symbol('a')
const instance = new class {}()
const promise = new Promise(() => {})
const func = function() {}
const lambda = () => {}
const asyncFunc = async function() {}
const asyncLambda = async function() {}

describe('isPlainObject()', () => {
  describe.each([
    [null, false],
    [module, false],
    [object, true],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isPlainObject(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isPlainObject(value)).toBe(expected)
      })
    }
  )
})

describe('isObject()', () => {
  describe.each([
    [null, false],
    [module, true],
    [object, true],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [Object(number), true],
    [Object(string), true],
    [Object(boolean), true],
    [date, true],
    [regexp, true],
    [symbol, false],
    [instance, true],
    [promise, true],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isObject(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isObject(value)).toBe(expected)
      })
    }
  )
})

describe('isArray()', () => {
  describe.each([
    [null, false],
    [module, false],
    [object, false],
    [array, true],
    [string, false],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isArray(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isArray(value)).toBe(expected)
      })
    }
  )
})

describe('isModule()', () => {
  describe.each([
    [null, false],
    [module, true],
    [object, false],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isModule(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isModule(value)).toBe(expected)
      })
    }
  )
})

describe('isFunction()', () => {
  describe.each([
    [null, false],
    [module, false],
    [object, false],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, true],
    [lambda, true],
    [asyncFunc, true],
    [asyncLambda, true]
  ])(
    'isFunction(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isFunction(value)).toBe(expected)
      })
    }
  )
})

describe('isNumber()', () => {
  describe.each([
    [null, false],
    [module, false],
    [object, false],
    [array, false],
    [string, false],
    [number, true],
    [Object(number), true],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isNumber(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isNumber(value)).toBe(expected)
      })
    }
  )
})

describe('isInteger()', () => {
  describe.each([
    [null, false],
    [module, false],
    [object, false],
    [array, false],
    [string, false],
    [number, true],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isInteger(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isInteger(value)).toBe(expected)
      })
    }
  )

  describe.each([
    13,
    123,
    0,
    -0,
    1,
    -1,
    +1
  ])(
    'isInteger(%o)',
    str => {
      it('returns true', () => {
        expect(isInteger(str)).toBe(true)
      })
    }
  )

  describe.each([
    -0.00000000001,
    123.123
  ])(
    'isInteger(%o)',
    str => {
      it('returns false', () => {
        expect(isInteger(str)).toBe(false)
      })
    }
  )
})

describe('isString()', () => {
  describe.each([
    [null, false],
    [object, false],
    [array, false],
    [string, true],
    [Object(string), true],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isString(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isString(value)).toBe(expected)
      })
    }
  )
})

describe('isBoolean()', () => {
  describe.each([
    [null, false],
    [object, false],
    [array, false],
    [string, false],
    [number, false],
    [boolean, true],
    [Object(boolean), true],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isBoolean(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isBoolean(value)).toBe(expected)
      })
    }
  )
})

describe('isDate()', () => {
  describe.each([
    [null, false],
    [object, false],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [date, true],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isDate(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isDate(value)).toBe(expected)
      })
    }
  )
})

describe('isRegExp()', () => {
  describe.each([
    [null, false],
    [object, false],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, true],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isRegExp(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isRegExp(value)).toBe(expected)
      })
    }
  )
})

describe('isPromise()', () => {
  const thenable = {
    then() {}
  }
  const thenableCatchable = {
    then() {},
    catch() {}
  }

  describe.each([
    [null, false],
    [object, false],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, true],
    [thenable, false],
    [thenableCatchable, true],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isPromise(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isPromise(value)).toBe(expected)
      })
    }
  )
})

describe('isAsync()', () => {
  describe.each([
    [null, false],
    [object, false],
    [array, false],
    [string, false],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, true],
    [asyncLambda, true]
  ])(
    'isAsync(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isAsync(value)).toBe(expected)
      })
    }
  )
})

describe('isArrayLike()', () => {
  describe.each([
    [null, false],
    [object, false],
    [array, true],
    [string, true],
    [number, false],
    [boolean, false],
    [date, false],
    [regexp, false],
    [symbol, false],
    [instance, false],
    [promise, false],
    [func, false],
    [lambda, false],
    [asyncFunc, false],
    [asyncLambda, false]
  ])(
    'isArrayLike(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isArrayLike(value)).toBe(expected)
      })
    }
  )
})

describe('isEmpty()', () => {
  describe.each([
    [null, true],
    [object, false],
    [{}, true],
    [array, false],
    [[], true],
    [string, false],
    ['', true]
  ])(
    'isEmpty(%o)',
    (value, expected) => {
      it(`returns ${expected}`, () => {
        expect(isEmpty(value)).toBe(expected)
      })
    }
  )
})

describe('asObject()', () => {
  it('returns received objects', () => {
    expect(asObject(object)).toBe(object)
  })

  it('converts a number to an object', () => {
    const actual = asObject(number)
    expect(actual).toBeInstanceOf(Object)
    expect(actual.valueOf()).toBe(number)
  })

  it('converts a string to an object', () => {
    const actual = asObject(string)
    expect(actual).toBeInstanceOf(Object)
    expect(actual.valueOf()).toBe(string)
  })

  it('converts a boolean to an object', () => {
    const actual = asObject(boolean)
    expect(actual).toBeInstanceOf(Object)
    expect(actual.valueOf()).toBe(boolean)
  })

  it('does not convert null or undefined', () => {
    expect(asObject(null)).toBe(null)
    expect(asObject(undefined)).toBe(undefined)
  })
})

describe('asArray()', () => {
  it('returns received objects', () => {
    expect(asArray(array)).toBe(array)
  })

  it('converts a primitive value to an array', () => {
    expect(asArray(number)).toStrictEqual([number])
  })

  it('converts `null` to an array containing `null`', () => {
    expect(asArray(null)).toStrictEqual([null])
  })

  it('converts `undefined` to an empty array', () => {
    expect(asArray(undefined)).toStrictEqual([])
  })
})

describe('asFunction()', () => {
  it('returns received functions', () => {
    expect(asFunction(func)).toBe(func)
  })

  it('converts a value to a function returning this value', () => {
    const actual = asFunction(number)
    expect(actual).toBeInstanceOf(Function)
    expect(actual()).toEqual(number)
  })
})
