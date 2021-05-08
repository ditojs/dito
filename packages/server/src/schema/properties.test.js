import { convertSchema, expandSchemaShorthand } from './properties'

describe('convertSchema()', () => {
  it('expands objects with properties to full JSON schemas', () => {
    const properties = {
      myString: {
        type: 'string'
      },
      myNumber: {
        type: 'number'
      },
      myInteger: {
        type: 'integer'
      },
      myBoolean: {
        type: 'boolean'
      },
      myObject: {
        type: 'object'
      },
      myArray: {
        type: 'array'
      }
    }
    expect(convertSchema(properties)).toEqual({
      type: 'object',
      properties,
      additionalProperties: false
    })
  })

  it('supports falsy default values', () => {
    const properties = {
      myString: {
        type: 'string',
        default: ''
      },
      myNumber: {
        type: 'number',
        default: 0
      },
      myInteger: {
        type: 'integer',
        default: 0
      },
      myBoolean: {
        type: 'boolean',
        default: false
      },
      myObject: {
        type: 'object',
        default: null
      },
      myArray: {
        type: 'array',
        default: null
      }
    }
    expect(convertSchema(properties)).toEqual({
      type: 'object',
      properties,
      additionalProperties: false
    })
  })

  it(`expands 'text' typess to 'string' JSON schema typess`, () => {
    expect(convertSchema({
      myText: {
        type: 'text'
      }
    })).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'string'
        }
      },
      additionalProperties: false
    })
  })

  it('expands strings property short-hands to property schemas', () => {
    expect(convertSchema({
      myNumber: 'number'
    })).toEqual({
      type: 'object',
      properties: {
        myNumber: {
          type: 'number'
        }
      },
      additionalProperties: false
    })
  })

  it('expands array property short-hands to array property schemas', () => {
    expect(convertSchema({
      myArray: [{
        type: 'number'
      }]
    })).toEqual({
      type: 'object',
      properties: {
        myArray: {
          type: 'array',
          items: {
            type: 'number'
          },
          default: []
        }
      },
      additionalProperties: false
    })
  })

  it('expands nested array property and object short-hands', () => {
    expect(convertSchema({
      myArray: [{
        myNumber: 'number'
      }]
    })).toEqual({
      type: 'object',
      properties: {
        myArray: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              myNumber: {
                type: 'number'
              }
            },
            additionalProperties: false
          },
          default: []
        }
      },
      additionalProperties: false
    })
  })

  it('adds `required` arrays and formats for required properties', () => {
    expect(convertSchema({
      myString: {
        type: 'string',
        required: true
      },
      myNumber: {
        type: 'number',
        required: true
      }
    })).toEqual({
      type: 'object',
      properties: {
        myString: {
          type: 'string',
          format: 'required'
        },
        myNumber: {
          type: 'number',
          format: 'required'
        }
      },
      additionalProperties: false,
      required: ['myString', 'myNumber']
    })
  })

  it(`expands 'object' schemas with properties to JSON schemas allowing no additional properties`, () => {
    expect(convertSchema({
      myText: {
        type: 'object',
        properties: {}
      }
    })).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          additionalProperties: false,
          properties: {}
        }
      },
      additionalProperties: false
    })
  })

  it('preserves preexisting settings for no additional properties', () => {
    expect(convertSchema({
      myText: {
        type: 'object',
        additionalProperties: true,
        properties: {}
      }
    })).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          additionalProperties: true,
          properties: {}
        }
      },
      additionalProperties: false
    })
  })

  it('expands nested object schemas with required properties', () => {
    expect(convertSchema({
      myText: {
        type: 'object',
        properties: {
          myProperty: {
            type: 'text',
            required: true
          }
        }
      }
    })).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          properties: {
            myProperty: {
              type: 'string',
              format: 'required'
            }
          },
          additionalProperties: false,
          required: ['myProperty']
        }
      },
      additionalProperties: false
    })
  })

  it(`expands 'object' schemas with patternProperties`, () => {
    expect(convertSchema({
      myText: {
        type: 'object',
        patternProperties: {
          '^.*$': {
            type: 'text'
          }
        }
      }
    })).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          patternProperties: {
            '^.*$': {
              type: 'string'
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    })
  })

  it('expands datetime types to their JSON schema representation', () => {
    expect(convertSchema({
      myDate: {
        type: 'date'
      },
      myDateTime: {
        type: 'datetime'
      },
      myTimeStamp: {
        type: 'timestamp'
      }
    })).toEqual({
      type: 'object',
      properties: {
        myDate: {
          type: ['string', 'object'],
          format: 'date-time'
        },
        myDateTime: {
          type: ['string', 'object'],
          format: 'date-time'
        },
        myTimeStamp: {
          type: ['string', 'object'],
          format: 'date-time'
        }
      },
      additionalProperties: false
    })
  })

  it('expands unrecognized types to `$ref` references', () => {
    expect(convertSchema({
      myModel: {
        type: 'MyModel'
      }
    })).toEqual({
      type: 'object',
      properties: {
        myModel: {
          $ref: 'MyModel'
        }
      },
      additionalProperties: false
    })
  })

  it(`expands unrecognized types to \`instanceof\` keywords when the \`useInstanceOf\` option is provided`, () => {
    expect(convertSchema({
      myModel: {
        type: 'MyModel'
      }
    }, {
      useInstanceOf: true
    })).toEqual({
      type: 'object',
      properties: {
        myModel: {
          type: 'object',
          instanceof: 'MyModel'
        }
      },
      additionalProperties: false
    })
  })

  it('handles `nullable: true` correctly (now natively supported)', () => {
    expect(convertSchema({
      myString: {
        type: 'string',
        nullable: true
      }
    })).toEqual({
      type: 'object',
      properties: {
        myString: {
          type: 'string',
          nullable: true
        }
      },
      additionalProperties: false
    })
  })

  it(`handles \`nullable: true\` references correctly`, () => {
    expect(convertSchema({
      myModel: {
        type: 'MyModel',
        nullable: true
      }
    })).toEqual({
      type: 'object',
      properties: {
        myModel: {
          oneOf: [
            { type: 'null' },
            { $ref: 'MyModel' }
          ]
        }
      },
      additionalProperties: false
    })
  })

  it(`handles \`nullable: true\` dates correctly (now natively supported)`, () => {
    expect(convertSchema({
      myDate: {
        type: 'date',
        nullable: true
      }
    })).toEqual({
      type: 'object',
      properties: {
        myDate: {
          type: ['string', 'object'],
          format: 'date-time',
          nullable: true
        }
      },
      additionalProperties: false
    })
  })

  it(`handles \`nullable: true\` enums correctly`, () => {
    expect(convertSchema({
      myEnum: {
        type: 'string',
        enum: ['one', 'two', 'three'],
        nullable: true
      }
    })).toEqual({
      type: 'object',
      properties: {
        myEnum: {
          type: 'string',
          enum: ['one', 'two', 'three', null],
          nullable: true
        }
      },
      additionalProperties: false
    })
  })
})

it('convert schemas within oneOf properties', () => {
  expect(convertSchema({
    myList: {
      type: 'array',
      items: {
        oneOf: [
          {
            prop1: {
              type: 'string',
              required: true
            },
            prop2: {
              type: 'number',
              required: true
            }
          },
          {
            type: 'object',
            properties: {
              prop3: {
                type: 'string',
                required: true
              },
              prop4: {
                type: 'number',
                required: true
              }
            }
          }
        ]
      }
    }
  })).toEqual({
    type: 'object',
    properties: {
      myList: {
        type: 'array',
        items: {
          oneOf: [
            {
              type: 'object',
              properties: {
                prop1: {
                  type: 'string',
                  format: 'required'
                },
                prop2: {
                  type: 'number',
                  format: 'required'
                }
              },
              required: ['prop1', 'prop2'],
              additionalProperties: false
            },
            {
              type: 'object',
              properties: {
                prop3: {
                  type: 'string',
                  format: 'required'
                },
                prop4: {
                  type: 'number',
                  format: 'required'
                }
              },
              required: ['prop3', 'prop4'],
              additionalProperties: false
            }
          ]
        }
      }
    },
    additionalProperties: false
  })
})

it('support `required: true` on object', () => {
  expect(convertSchema({
    myObject: {
      type: 'object',
      required: true,
      properties: {
        prop1: {
          type: 'string',
          required: true
        },
        prop2: {
          type: 'number',
          required: true
        }
      }
    }
  })).toEqual({
    type: 'object',
    properties: {
      myObject: {
        type: 'object',
        format: 'required',
        properties: {
          prop1: {
            format: 'required',
            type: 'string'
          },
          prop2: {
            format: 'required',
            type: 'number'
          }
        },
        additionalProperties: false,
        required: ['prop1', 'prop2']
      }
    },
    additionalProperties: false,
    required: ['myObject']
  })
})

it('support `required` on object short-hand', () => {
  expect(convertSchema({
    myObject: {
      required: true,
      prop1: {
        type: 'string',
        required: true
      },
      prop2: {
        type: 'number',
        required: true
      }
    }
  })).toEqual({
    type: 'object',
    properties: {
      myObject: {
        type: 'object',
        format: 'required',
        properties: {
          prop1: {
            type: 'string',
            format: 'required'
          },
          prop2: {
            type: 'number',
            format: 'required'
          }
        },
        additionalProperties: false,
        required: ['prop1', 'prop2']
      }
    },
    additionalProperties: false,
    required: ['myObject']
  })
})

describe('expandSchemaShorthand()', () => {
  it('expands strings to schemas', () => {
    expect(expandSchemaShorthand('number')).toEqual({
      type: 'number'
    })
  })

  it('expands array property short-hands to array property schemas', () => {
    expect(expandSchemaShorthand([{
      type: 'number'
    }])).toEqual({
      type: 'array',
      items: {
        type: 'number'
      },
      default: []
    })
  })

  it('expands objects property short-hands to object property schemas', () => {
    expect(expandSchemaShorthand({
      myNumber: {
        type: 'number'
      }
    })).toEqual({
      type: 'object',
      properties: {
        myNumber: {
          type: 'number'
        }
      }
    })
  })
})
