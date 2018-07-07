// This keyword is used to validate reference-only data in relations: { id: 1 }
// See @/schema/relation.js for more details
export const reference = {
  silent: true,

  metaSchema: {
    type: 'boolean'
  },

  validate(schema, data, parentSchema, dataPath, parentData, property) {
    if (schema) {
      // if `schema === true`, then the `parentData` can only contain one
      // property: The one that this keyword is applied to:
      const keys = Object.keys(parentData)
      return keys.length === 1 && keys[0] === property
    }
    return true
  }
}
