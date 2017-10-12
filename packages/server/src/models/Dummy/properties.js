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
  dogs: [
    'string'
  ],
  age: 'integer',
  factor: {
    type: 'number',
    range: [0, 50],
    required: true
  },
  colors: [
    'string'
  ],
  verified: 'boolean',
  comments: 'string'
}
