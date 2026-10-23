// Valid and invalid values per definition, with the expected messages, shared
// by the tests of the definitions and the parity tests of their engines:

export const formats = {
  color: {
    valid: ['#f80', '#f80c', '#ff8800', '#FF8800CC'],
    invalid: ['', 'f80', '#ff', '#ff88001', '#gg8800', 'orange'],
    message: 'must be a hex color'
  },
  empty: {
    valid: ['', null, undefined, 0, false],
    invalid: ['a', 1, true],
    message: 'must be empty'
  },
  required: {
    valid: ['a', 0, false, []],
    invalid: ['', null, undefined],
    message: 'is required'
  }
}

export const keywords = {
  type: [
    {
      setting: 'string',
      valid: ['', 'a'],
      invalid: [1, null, [], {}],
      message: 'must be a string'
    },
    {
      setting: 'number',
      valid: [0, 1.5, -2],
      invalid: ['1', Infinity, NaN, null],
      message: 'must be a number'
    },
    {
      setting: 'integer',
      valid: [0, -2, 3.0],
      invalid: [1.5, '1', Infinity, NaN],
      message: 'must be a whole number'
    },
    {
      setting: 'boolean',
      valid: [true, false],
      invalid: [0, 'true', null],
      message: 'must be a boolean'
    },
    {
      setting: 'array',
      valid: [[], [1]],
      invalid: [{}, 'a', null],
      message: 'must be a list'
    },
    {
      setting: 'object',
      valid: [{}, { a: 1 }],
      invalid: [[], null, 'a'],
      message: 'must be an object'
    },
    {
      setting: ['string', 'null'],
      valid: ['a', null],
      invalid: [1, undefined],
      message: 'must be a string or null'
    },
    {
      setting: ['integer', 'string', 'null'],
      valid: [1, 'a', null],
      invalid: [1.5, false],
      message: 'must be a whole number, a string or null'
    }
  ],
  enum: [
    {
      setting: ['a', 1, { b: 2 }],
      message: 'must be one of the allowed values'
    }
  ],
  minimum: [
    {
      setting: 5,
      valid: [5, 6.5, '1'],
      invalid: [4.9, -5],
      message: 'must be 5 or more'
    }
  ],
  maximum: [
    {
      setting: 10,
      valid: [10, -1, '11'],
      invalid: [10.1, 100],
      message: 'must be 10 or less'
    }
  ],
  range: [
    {
      setting: [-1, 1],
      valid: [-1, 0, 1, 'a'],
      invalid: [-1.1, 2],
      message: 'must be between -1 and 1'
    }
  ],
  multipleOf: [
    {
      setting: 5,
      message: 'must be a multiple of 5'
    }
  ],
  decimals: [
    {
      setting: 2,
      valid: ['1.25', 1.25, '-1.5', '+1', '.5'],
      invalid: ['1.255', '1.', '1,5', 'a', '-', '+', '.'],
      message: 'must be a number with at most 2 decimal places'
    },
    {
      setting: 8,
      valid: [1e-7, -1e-7],
      invalid: [1e-9],
      message: 'must be a number with at most 8 decimal places'
    },
    {
      setting: 1,
      valid: ['1.5', 2],
      invalid: ['1.25'],
      message: 'must be a number with at most one decimal place'
    },
    {
      setting: 0,
      valid: ['1', '-12', 3],
      invalid: ['1.5', 1.5],
      message: 'must be a whole number'
    },
    {
      setting: '*',
      valid: ['1.123456789', 1.125, 1e-7, 1e21],
      invalid: ['1.', '.'],
      message: 'must be a number'
    }
  ],
  minLength: [
    {
      setting: 1,
      valid: ['a', 5],
      invalid: [''],
      message: 'must not be empty'
    },
    {
      // Two UTF-16 units, one code point:
      setting: 2,
      valid: ['ab', 'abc'],
      invalid: ['a', '😀'],
      message: 'must be at least 2 characters long'
    }
  ],
  maxLength: [
    {
      setting: 1,
      valid: ['', 'a', '😀', ['a', 'b']],
      invalid: ['ab'],
      message: 'must be at most one character long'
    },
    {
      setting: 3,
      valid: ['abc'],
      invalid: ['abcd'],
      message: 'must be at most 3 characters long'
    }
  ],
  pattern: [
    {
      setting: '^[A-Z]+-\\d+$',
      valid: ['AB-12', 12],
      invalid: ['ab-12', ''],
      message: 'must match pattern "^[A-Z]+-\\d+$"'
    },
    {
      // Unicode property escapes need the `u` flag:
      setting: '^\\p{Lu}+$',
      valid: ['ÄB'],
      invalid: ['äb'],
      message: 'must match pattern "^\\p{Lu}+$"'
    }
  ],
  minItems: [
    {
      setting: 1,
      valid: [['a'], 'abc'],
      invalid: [[]],
      message: 'must contain at least one item'
    },
    {
      setting: 2,
      valid: [['a', 'b']],
      invalid: [['a']],
      message: 'must contain at least 2 items'
    }
  ],
  maxItems: [
    {
      setting: 1,
      valid: [[], ['a']],
      invalid: [['a', 'b']],
      message: 'must contain at most one item'
    },
    {
      setting: 2,
      valid: [['a', 'b'], 'abc'],
      invalid: [['a', 'b', 'c']],
      message: 'must contain at most 2 items'
    }
  ]
}
