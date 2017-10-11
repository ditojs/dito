import Model from '../Model'

class Dummy extends Model {
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  async hello(msg) {
    // await Promise.delay(180 * 1000)
    return `Hello ${this.fullName}: ${msg}`
  }

  static someStaticMethod() {
    // NOTE: This will be present as a static member method:
    // Dummy.someStaticMethod()
  }

  static jsonSchema = {
    type: 'object',
    required: ['firstName', 'lastName', 'country', 'factor'],
    properties: {
      id: { type: 'integer' },
      firstName: {
        type: ['string'],
        format: 'required'
      },
      lastName: {
        type: 'string',
        format: 'required'
      },
      fullName: {
        type: ['string', 'null']
      },
      prefix: {
        type: ['string', 'null']
      },
      country: {
        type: 'string',
        format: 'required'
      },
      dateOfBirth: {
        type: ['string', 'object', 'null'],
        format: 'date-time'
      },
      email: {
        type: ['string', 'null'],
        format: 'email'
      },
      dogs: {
        type: ['array', 'null'],
        items: {
          type: 'string'
        }
      },
      age: {
        type: ['integer', 'null']
      },
      factor: {
        type: 'number',
        range: [0, 50],
        format: 'required'
      },
      colors: {
        type: ['array', 'null'],
        items: {
          type: 'string'
        }
      },
      verified: {
        type: ['boolean', 'null']
      },
      comments: {
        type: ['string', 'null']
      }
      /*
      createdAt: {
        type: ['string', 'object', 'null'],
        format: 'date-time'
      },
      updatedAt: {
        type: ['string', 'object', 'null'],
        format: 'date-time'
      }
      */
    }
  }
}

export default Dummy
