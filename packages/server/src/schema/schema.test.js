import { convertSchema } from './schema.js'

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
    expect(
      convertSchema({
        type: 'object',
        properties
      })
    ).toEqual({
      type: 'object',
      properties,
      unevaluatedProperties: false
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
    expect(
      convertSchema({
        type: 'object',
        properties
      })
    ).toEqual({
      type: 'object',
      properties,
      unevaluatedProperties: false
    })
  })

  it(`expands 'text' types to 'string' JSON schema types`, () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myText: {
            type: 'text'
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'string'
        }
      },
      unevaluatedProperties: false
    })
  })

  it('adds `required` arrays and formats for required properties', () => {
    expect(
      convertSchema({
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
      })
    ).toEqual({
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
      unevaluatedProperties: false,
      required: ['myString', 'myNumber']
    })
  })

  it('preserves JSON schema-style `required` arrays', () => {
    expect(
      convertSchema({
        type: 'object',
        required: ['myString', 'myNumber'],
        properties: {
          myString: { type: 'string' },
          myNumber: { type: 'number' }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myString: { type: 'string' },
        myNumber: { type: 'number' }
      },
      unevaluatedProperties: false,
      required: ['myString', 'myNumber']
    })
  })

  it(`expands 'object' schemas with properties to JSON schemas allowing no unevaluated properties`, () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myText: {
            type: 'object',
            properties: {}
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          unevaluatedProperties: false,
          properties: {}
        }
      },
      unevaluatedProperties: false
    })
  })

  it('preserves pre-existing settings for no unevaluated properties', () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myText: {
            type: 'object',
            unevaluatedProperties: true,
            properties: {}
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          unevaluatedProperties: true,
          properties: {}
        }
      },
      unevaluatedProperties: false
    })
  })

  it('expands nested object schemas with required properties', () => {
    expect(
      convertSchema({
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
      })
    ).toEqual({
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
          unevaluatedProperties: false,
          required: ['myProperty']
        }
      },
      unevaluatedProperties: false
    })
  })

  it(`expands 'object' schemas with patternProperties`, () => {
    expect(
      convertSchema({
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
      })
    ).toEqual({
      type: 'object',
      properties: {
        myText: {
          type: 'object',
          patternProperties: {
            '^.*$': {
              type: 'string'
            }
          },
          unevaluatedProperties: false
        }
      },
      unevaluatedProperties: false
    })
  })

  it('expands datetime types to their JSON schema representation', () => {
    expect(
      convertSchema({
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
      })
    ).toEqual({
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
      unevaluatedProperties: false
    })
  })

  it('expands unrecognized types to `$ref` references', () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myModel: {
            type: 'MyModel'
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myModel: {
          $ref: 'MyModel'
        }
      },
      unevaluatedProperties: false
    })
  })

  it(`expands unrecognized types to \`instanceof\` keywords when the \`useInstanceOf\` option is provided`, () => {
    expect(
      convertSchema(
        {
          type: 'object',
          properties: {
            myModel: {
              type: 'MyModel'
            }
          }
        },
        {
          useInstanceOf: true
        }
      )
    ).toEqual({
      type: 'object',
      properties: {
        myModel: {
          type: 'object',
          instanceof: 'MyModel'
        }
      },
      unevaluatedProperties: false
    })
  })

  it('handles `nullable: true` correctly (now natively supported)', () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myString: {
            type: 'string',
            nullable: true
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myString: {
          type: 'string',
          nullable: true
        }
      },
      unevaluatedProperties: false
    })
  })

  it(`handles \`nullable: true\` references correctly`, () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myModel: {
            type: 'MyModel',
            nullable: true
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myModel: {
          oneOf: [
            { type: 'null' },
            { $ref: 'MyModel' }
          ]
        }
      },
      unevaluatedProperties: false
    })
  })

  it(`handles \`nullable: true\` dates correctly (now natively supported)`, () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myDate: {
            type: 'date',
            nullable: true
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myDate: {
          type: ['string', 'object'],
          format: 'date-time',
          nullable: true
        }
      },
      unevaluatedProperties: false
    })
  })

  it(`handles \`nullable: true\` enums correctly`, () => {
    expect(
      convertSchema({
        type: 'object',
        properties: {
          myEnum: {
            type: 'string',
            enum: ['one', 'two', 'three'],
            nullable: true
          }
        }
      })
    ).toEqual({
      type: 'object',
      properties: {
        myEnum: {
          type: 'string',
          enum: ['one', 'two', 'three', null],
          nullable: true
        }
      },
      unevaluatedProperties: false
    })
  })

  it('converts schemas within oneOf properties', () => {
    expect(
      convertSchema({
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
      })
    ).toEqual({
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
                unevaluatedProperties: false
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
                unevaluatedProperties: false
              }
            ]
          }
        }
      },
      unevaluatedProperties: false
    })
  })

  it('supports `required: true` on object', () => {
    expect(
      convertSchema({
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
      })
    ).toEqual({
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
          unevaluatedProperties: false,
          required: ['prop1', 'prop2']
        }
      },
      unevaluatedProperties: false,
      required: ['myObject']
    })
  })

  it('processes discriminator schemas correctly', () => {
    expect(
      convertSchema({
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
      })
    ).toEqual({
      type: 'object',
      discriminator: { propertyName: 'foo' },
      unevaluatedProperties: false,
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

  it('supports nested Dito.js definitions', () => {
    expect(
      convertSchema(
        {
          type: 'object',
          properties: {
            prop1: {
              $ref: '#type1'
            },
            prop2: {
              type: 'object',
              properties: {
                prop3: {
                  $ref: '#type2'
                }
              },
              definitions: {
                '#type2': {
                  type: 'object',
                  properties: {
                    prop4: {
                      type: 'string'
                    },

                    prop5: {
                      $ref: '#type3'
                    }
                  },

                  definitions: {
                    '#type3': {
                      type: 'boolean'
                    }
                  }
                }
              }
            }
          },

          definitions: {
            '#type1': {
              type: 'integer'
            }
          }
        }
      )
    ).toEqual({
      type: 'object',
      unevaluatedProperties: false,
      properties: {
        prop1: {
          $ref: '#/definitions/#type1'
        },
        prop2: {
          type: 'object',
          unevaluatedProperties: false,
          properties: {
            prop3: {
              $ref: '#/definitions/#type2'
            }
          }
        }
      },
      definitions: {
        '#type1': {
          type: 'integer'
        },
        '#type2': {
          type: 'object',
          unevaluatedProperties: false,
          properties: {
            prop4: {
              type: 'string'
            },
            prop5: {
              $ref: '#/definitions/#type3'
            }
          }
        },
        '#type3': {
          type: 'boolean'
        }
      }
    })
  })
})
