export default {
  firstName: {
    type: 'string',
    required: true
  },
  lastName: {
    type: 'string',
    required: true
  },
  fullName: {
    type: 'string',
    computed: true
  },
  prefix: 'string',
  country: {
    type: 'string',
    required: true
  },
  dateOfBirth: {
    type: 'date'
  },
  email: {
    type: 'string',
    format: 'email'
  },
  age: 'integer',
  factor: {
    type: 'number',
    range: [0, 50],
    required: true
  },
  dogs: {
    type: 'array',
    items: {
      type: 'string'
    }
  },
  colors: {
    type: 'array',
    items: {
      type: 'string'
    }
  },
  verified: 'boolean',
  comments: 'string'
}
