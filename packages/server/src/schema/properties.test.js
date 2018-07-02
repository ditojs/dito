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
    expect(convertSchema(properties)).toEqual(getPropertySchema(properties))
  })

  it(`expands 'text' objects to 'string' JSON schema properties`, () => {
    expect(convertSchema({
      myText: {
        type: 'text'
      }
    })).toEqual(getPropertySchema({
      myText: {
        type: 'string'
      }
    }))
  })

  it('expands strings property short-hands to property schemas', () => {
    expect(convertSchema({
      myNumber: 'number'
    })).toEqual(getPropertySchema({
      myNumber: {
        type: 'number'
      }
    }))
  })

  it('expands array property short-hands to array property schemas', () => {
    expect(convertSchema({
      myArray: [{
        type: 'number'
      }]
    })).toEqual(getPropertySchema({
      myArray: {
        type: 'array',
        items: {
          type: 'number'
        },
        default: []
      }
    }))
  })

  it('expands nested array property and object short-hands', () => {
    expect(convertSchema({
      myArray: [{
        myNumber: 'number'
      }]
    })).toEqual(getPropertySchema({
      myArray: {
        type: 'array',
        items: getPropertySchema({
          myNumber: {
            type: 'number'
          }
        }),
        default: []
      }
    }))
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
    })).toEqual(getPropertySchema(
      {
        myString: {
          type: 'string',
          format: 'required'
        },
        myNumber: {
          type: 'number',
          format: 'required'
        }
      },
      ['myString', 'myNumber'] // required
    ))
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
    })).toEqual(getPropertySchema({
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
    }))
  })

  it('expands unrecognized types to `$ref` references', () => {
    expect(convertSchema({
      myModel: {
        type: 'MyModel'
      }
    })).toEqual(getPropertySchema({
      myModel: {
        $ref: 'MyModel'
      }
    }))
  })

  it('expands unrecognized types to `instanceof` keywords', () => {
    expect(convertSchema({
      myModel: {
        type: 'MyModel'
      }
    }, {
      useInstanceOf: true
    })).toEqual(getPropertySchema({
      myModel: {
        type: 'object',
        instanceof: 'MyModel'
      }
    }))
  })

  it('expands `nullable` to JSON schema representation', () => {
    expect(convertSchema({
      myString: {
        type: 'string',
        nullable: true
      }
    })).toEqual(getPropertySchema({
      myString: {
        type: ['string', 'null'],
        nullable: true
      }
    }))
  })

  it('expands `nullable` references to JSON schema representation', () => {
    expect(convertSchema({
      myModel: {
        type: 'MyModel',
        nullable: true
      }
    })).toEqual(getPropertySchema({
      myModel: {
        oneOf: [
          {
            $ref: 'MyModel'
          },
          {
            type: 'null'
          }
        ],
        nullable: true
      }
    }))
  })

  it('expands `nullable` dates to JSON schema representation', () => {
    expect(convertSchema({
      myDate: {
        type: 'date',
        nullable: true
      }
    })).toEqual(getPropertySchema({
      myDate: {
        oneOf: [
          {
            type: ['string', 'object'],
            format: 'date-time'
          },
          {
            type: 'null'
          }
        ],
        nullable: true
      }
    }))
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
      property: {
        type: 'number'
      }
    })).toEqual(
      getPropertySchema({
        property: {
          type: 'number'
        }
      })
    )
  })
})

function getPropertySchema(properties, required) {
  return {
    type: 'object',
    properties,
    ...(required && { required }),
    additionalProperties: false
  }
}
