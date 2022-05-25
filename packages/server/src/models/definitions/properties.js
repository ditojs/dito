import { mergeReversed } from '../../utils/index.js'

export default function properties(values) {
  const properties = mergeReversed(values)
  // Include auto-generated 'id' properties for models and relations.
  const addIdProperty = (name, schema) => {
    if (!(name in properties)) {
      properties[name] = {
        type: 'integer',
        ...schema
      }
    }
  }

  for (const name of this.getIdPropertyArray()) {
    addIdProperty(name, {
      primary: true
    })
  }

  const addRelationProperties = (relation, propName) => {
    const modelClass = relation.ownerModelClass
    const { nullable } = modelClass.definition.relations[relation.name]
    for (const property of relation[propName].props) {
      addIdProperty(property, {
        unsigned: true,
        foreign: true,
        index: true,
        ...(nullable && { nullable })
      })
    }
  }

  for (const relation of Object.values(this.getRelations())) {
    addRelationProperties(relation, 'ownerProp')
  }

  for (const relation of this.getRelatedRelations()) {
    addRelationProperties(relation, 'relatedProp')
  }

  // Support Objection's #id and #ref references on all models:
  properties[this.uidProp] = {
    type: 'string'
  }
  properties[this.uidRefProp] = {
    type: 'string'
  }

  // Convert root-level short-forms, for easier properties handling in
  // attributes and idColumn() & co:
  // - `name: type` to `name: { type }`
  // - `name: [...items]` to `name: { type: 'array', items }
  // NOTE: Substitutions on all other levels happen in convertSchema()
  const ids = []
  const rest = []
  for (const [name, property] of Object.entries(properties)) {
    // Also sort properties by kind: primary id > foreign id > rest:
    const entry = [name, property]
    if (property.primary) {
      ids.unshift(entry)
    } else if (property.foreign) {
      ids.push(entry)
    } else {
      rest.push(entry)
    }
  }
  // Finally recompile a new properties object out of the sorted properties.
  return [...ids, ...rest].reduce((merged, [name, property]) => {
    merged[name] = property
    return merged
  }, {})
}
