import {
  createTemporaryId,
  getRelativeDataPath,
  isTemporaryId
} from './data.js'
import { getRelateKey } from './schema/options.ts'
import {
  isInteger,
  asArray,
  parseDataPath,
  getValueAtDataPath
} from '@ditojs/utils'
import { nanoid } from 'nanoid'

// Collect the sources and relations of data to serialize their ids for the
// targets 'server' and 'clipboard':
// | --------------------------------------------| --------- | --------- |
// | data                                        | server    | clipboard |
// | --------------------------------------------| --------- | --------- |
// | type: 'relation', internal: false           | keep id   | keep id   |
// | type: 'relation', internal: true            | keep id   | new @id   |
// | type: 'relation', internal: true, temporary | ref, #ref | new @id   |
// | type: 'source', related: false              | keep id   | remove id |
// | type: 'source', related: false, temporary   | ref, #id  | remove id |
// | type: 'source', related: true               | keep id   | new @id   |
// | type: 'source', related: true, temporary    | ref, #id  | new @id   |
// | --------------------------------------------| --------- | --------- |
// Data paths are absolute. Relations outside of `dataPath` are external.
// Copies get a new temporary id per id of each list, shared by the relations
// to its items.

export class SchemaGraph {
  graph = {}
  references = {}

  constructor(dataPath = '') {
    this.dataPath = dataPath
  }

  set(dataPath, settings, defaults) {
    const path = parseDataPath(getRelativeDataPath(dataPath, this.dataPath))
    let subGraph = this.graph
    for (const part of path) {
      const key = isInteger(+part) ? '*' : part
      subGraph = subGraph[key] ??= {}
    }
    subGraph.$settings = {
      ...defaults,
      ...subGraph.$settings,
      ...settings
    }
  }

  addSource(dataPath, schema) {
    // Default to `related: false`, as `setSourceRelated()` may come first:
    this.set(dataPath, { type: 'source', schema }, { related: false })
  }

  setSourceRelated(dataPath) {
    this.set(dataPath, {
      related: true,
      reference: this.getReferencePrefix(dataPath)
    })
  }

  addRelation(dataPath, relatedDataPath, schema) {
    const internal = !!getRelativeDataPath(relatedDataPath, this.dataPath)
    this.set(dataPath, {
      type: 'relation',
      schema,
      internal,
      reference: internal ? this.getReferencePrefix(relatedDataPath) : null
    })
    if (internal) {
      this.setSourceRelated(relatedDataPath)
    }
  }

  getReferencePrefix(dataPath) {
    return dataPath
      ? (this.references[dataPath] ??= nanoid(6))
      : null
  }

  flatten() {
    const flatten = graph => {
      const entries = []
      for (const [key, { $settings, ...subGraph }] of Object.entries(graph)) {
        if ($settings) {
          entries.push([key, $settings])
        }
        for (const [subKey, settings] of flatten(subGraph)) {
          entries.push([`${key}/${subKey}`, settings])
        }
      }
      return entries
    }

    return flatten(this.graph)
  }

  serialize(sourceSchema, data, { target }) {
    const clipboard = target === 'clipboard'
    const temporaryIds = {}
    if (clipboard) {
      delete data[sourceSchema.idKey || 'id']
    }
    for (const [dataPath, settings] of this.flatten()) {
      const { type, schema, internal, related, reference } = settings
      const source = type === 'source'
      const relation = type === 'relation'
      if (source || relation && internal) {
        const values = getValueAtDataPath(data, dataPath, () => null)
        const idKey = source ? schema.idKey || 'id' : getRelateKey(schema)
        for (const value of asArray(values).flat()) {
          const id = value?.[idKey]
          if (id != null) {
            if (clipboard) {
              if (source && !related) {
                // Nothing references the ids of unrelated sources:
                delete value[idKey]
              } else {
                value[idKey] = temporaryIds[`${reference}-${id}`] ??=
                  createTemporaryId()
              }
            } else if (isTemporaryId(id)) {
              // The server wants Objection-style '#id' / '#ref' pairs, unique
              // per reference group, as they reference across the full graph:
              const temporaryId = id.slice(1)
              value[source ? '#id' : '#ref'] = reference
                ? `${reference}-${temporaryId}`
                : temporaryId
              delete value[idKey]
            }
          }
        }
      }
    }
    return data
  }
}
