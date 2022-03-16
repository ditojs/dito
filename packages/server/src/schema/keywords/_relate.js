// This keyword is used to validate reference-only data in relations: { id: 1 }
// See ../schema/relation.js for more details
export const relate = {
  silent: true,

  metaSchema: {
    type: 'string'
  },

  validate(schema, data) {
    return this.app?.models[schema]?.isReference(data) || false
  }
}
