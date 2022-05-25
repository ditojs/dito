import { convertSchema } from './properties.js'

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
    expect(convertSchema({
      type: 'object',
      properties
    })).toEqual({
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
    expect(convertSchema({
      type: 'object',
      properties
    })).toEqual({
      type: 'object',
      properties,
      additionalProperties: false
    })
  })

  it(`expands 'text' typess to 'string' JSON schema typess`, () => {
    expect(convertSchema({
      type: 'object',
      properties: {
        myText: {
          type: 'text'
        }
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

  it('adds `required` arrays and formats for required properties', () => {
    expect(convertSchema({
      type: 'object',
      properties: {
        myString: {
          type: 'string',
          required: true
        },
        myNumber: {
          type: 'number',
          required: true
        }
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

  it('preserves JSON schema-style `required` arrays', () => {
    expect(convertSchema({
      type: 'object',
      required: ['myString', 'myNumber'],
      properties: {
        myString: { type: 'string' },
        myNumber: { type: 'number' }
      }
    })).toEqual({
      type: 'object',
      properties: {
        myString: { type: 'string' },
        myNumber: { type: 'number' }
      },
      additionalProperties: false,
      required: ['myString', 'myNumber']
    })
  })

  it(`expands 'object' schemas with properties to JSON schemas allowing no additional properties`, () => {
    expect(convertSchema({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          properties: {}
        }
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
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          additionalProperties: true,
          properties: {}
        }
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
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          properties: {
            myProperty: {
              type: 'text',
              required: true
            }
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
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          patternProperties: {
            '^.*$': {
              type: 'text'
            }
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
      type: 'object',
      properties: {
        myDate: {
          type: 'date'
        },
        myDateTime: {
          type: 'datetime'
        },
        myTimeStamp: {
          type: 'timestamp'
        }
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
      type: 'object',
      properties: {
        myModel: {
          type: 'MyModel'
        }
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
      type: 'object',
      properties: {
        myModel: {
          type: 'MyModel'
        }
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
      type: 'object',
      properties: {
        myString: {
          type: 'string',
          nullable: true
        }
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
      type: 'object',
      properties: {
        myModel: {
          type: 'MyModel',
          nullable: true
        }
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
      type: 'object',
      properties: {
        myDate: {
          type: 'date',
          nullable: true
        }
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
      type: 'object',
      properties: {
        myEnum: {
          type: 'string',
          enum: ['one', 'two', 'three'],
          nullable: true
        }
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

  it('converts schemas within oneOf properties', () => {
    expect(convertSchema({
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
                    required: true
                  },
                  prop2: {
                    type: 'number',
                    required: true
                  }
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

  it('supports `required: true` on object', () => {
    expect(convertSchema({
      type: 'object',
      properties: {
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

  it('processes discriminator schemas correctly', () => {
    expect(convertSchema({
      type: 'object',
      discriminator: { propertyName: 'foo' },
      required: ['foo'],
      oneOf: [
        {
          properties: {
            foo: { const: 'x' },
            a: {
              type: 'string',
              required: true
            }
          }
        },
        {
          properties: {
            foo: { enum: ['y', 'z'] },
            b: {
              type: 'string',
              required: true
            }
          }
        }
      ]
    })).toEqual({
      type: 'object',
      discriminator: { propertyName: 'foo' },
      required: ['foo'],
      oneOf: [
        {
          properties: {
            foo: { const: 'x' },
            a: {
              type: 'string',
              format: 'required'
            }
          },
          required: ['a']
        },
        {
          properties: {
            foo: { enum: ['y', 'z'] },
            b: {
              type: 'string',
              format: 'required'
            }
          },
          required: ['b']
        }
      ]
    })
  })
})
