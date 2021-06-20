import { hasTemporaryId } from './data'
import {
  isInteger, asArray, parseDataPath, getValueAtDataPath
} from '@ditojs/utils'
import { nanoid } from 'nanoid'

export class SchemaGraph {
  graph = {}
  references = {}

  add(dataPath, settings, defaults) {
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

  addSource(dataPath) {
    // Only set `related: false` through the defaults, as `addRelatedSource()`
    // may be called before `addSource()`, depending on the graph structure.
    this.add(dataPath, { type: 'source' }, { related: false })
  }

  addRelatedSource(dataPath) {
    this.add(dataPath, {
      type: 'source',
      related: true,
      reference: this.getReferencePrefix(dataPath)
    })
  }

  addRelation(dataPath, relatedDataPath) {
    this.add(dataPath, {
      type: 'relation',
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

  process(data, { target }) {
    const clipboard = target === 'clipboard'
    if (clipboard) {
      delete data.id
    }
    for (const [dataPath, settings] of this.flatten()) {
      const { type, internal, related, reference } = settings
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
          const id = value?.id
          if (id != null) {
            if (removeId) {
              delete value.id
            } if (referenceId || hasTemporaryId(value)) {
              value[source ? '#id' : '#ref'] = reference
                ? `${reference}-${id}`
                : id // A temporary id without a related, just preserve it.
              delete value.id
            }
          }
        }
      }
    }
    return data
  }
}
