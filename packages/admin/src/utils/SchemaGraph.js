import { isTemporaryId } from './data.js'
import {
  isInteger, asArray, parseDataPath, getValueAtDataPath
} from '@ditojs/utils'
import { nanoid } from 'nanoid'

// SchemaGraph is a class to collect schema graph meta information in order to
// process sources and relations for the given targets 'server' and 'clipboard',
// acccording to the following table:
//
// | --------------------------------------------| --------- | --------- |
// | data                                        | server    | clipboard |
// | --------------------------------------------| --------- | --------- |
// | type: 'relation', internal: false           | keep id   | keep id   |
// | type: 'relation', internal: true            | keep id   | ref, #ref |
// | type: 'relation', internal: true, temporary | ref, #ref | ref, #ref |
// | type: 'source', related: false              | keep id   | remove id |
// | type: 'source', related: false, temporary   | ref, #id  | remove id |
// | type: 'source', related: true               | keep id   | ref, #id  |
// | type: 'source', related: true, temporary    | ref, #id  | ref, #id  |
// | --------------------------------------------| --------- | --------- |

export class SchemaGraph {
  graph = {}
  references = {}

  set(dataPath, settings, defaults) {
    dataPath = parseDataPath(dataPath)
    let subGraph = this.graph
    for (const part of dataPath) {
      const key = isInteger(+part) ? '*' : part
      subGraph = (subGraph[key] ??= {})
    }
    subGraph.$settings = {
      ...defaults, // See `addSource(dataPath)`
      ...subGraph.$settings,
      ...settings
    }
  }

  addSource(dataPath, schema) {
    // Only set `related: false` through the defaults, as `setSourceRelated()`
    // may be called before `addSource()`, depending on the graph structure.
    this.set(dataPath, { type: 'source', schema }, { related: false })
  }

  setSourceRelated(dataPath) {
    this.set(dataPath, {
      related: true,
      reference: this.getReferencePrefix(dataPath)
    })
  }

  addRelation(dataPath, relatedDataPath, schema) {
    this.set(dataPath, {
      type: 'relation',
      schema,
      internal: !!relatedDataPath,
      reference: this.getReferencePrefix(relatedDataPath)
    })
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

  process(sourceSchema, data, { target }) {
    const clipboard = target === 'clipboard'
    if (clipboard) {
      delete data[sourceSchema.idKey || 'id']
    }
    for (const [dataPath, settings] of this.flatten()) {
      const { type, schema, internal, related, reference } = settings
      const source = type === 'source'
      const relation = type === 'relation'
      if (source || relation && internal) {
        const values = getValueAtDataPath(data, dataPath, () => null)
        const removeId = clipboard && source && !related
        const referenceId = clipboard && (
          relation && internal ||
          source && related
        )
        for (const value of asArray(values).flat()) {
          const idKey = (
            source && schema.idKey ||
            relation && schema.relateBy ||
            'id'
          )
          let id = value?.[idKey]
          if (id != null) {
            if (removeId) {
              delete value[idKey]
            } if (referenceId || isTemporaryId(id)) {
              if (isTemporaryId(id)) {
                id = id.slice(1)
              }
              const refKey = clipboard
                // Clipboard just needs temporary ids under the actual `idKey`.
                ? idKey
                // Server wants Objection-style '#id' / '#ref' pairs.
                : source ? '#id' : '#ref'
              const revValue = clipboard
                ? `@${id}`
                // Keep the ids unique in reference groups, since they reference
                // accross the full graph.
                : reference
                  ? `${reference}-${id}`
                  : id // A temporary id without a related, just preserve it.
              value[refKey] = revValue
              if (refKey !== idKey) {
                delete value[idKey]
              }
            }
          }
        }
      }
    }
    return data
  }
}
