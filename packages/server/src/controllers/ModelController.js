import pluralize from 'pluralize'
import { isObject, camelize } from '@ditojs/utils'
import { ControllerError } from '@/errors'
import { CollectionController } from './CollectionController'
import { RelationController } from './RelationController'

export class ModelController extends CollectionController {
  initialize() {
    super.initialize(true)
    this.modelClass = this.modelClass ||
      this.app.models[camelize(pluralize.singular(this.name), true)]
    this.relations = this.setupRelations('relations')
  }

  setupRelations(type) {
    const relations = this.inheritValues(type)
    for (const name in relations) {
      const relation = relations[name]
      if (isObject(relation)) {
        relations[name] = this.setupRelation(relation, name)
      } else {
        throw new ControllerError(this, `Invalid relation "${name}".`)
      }
    }
    return relations
  }

  setupRelation(relation, name) {
    const modelRelation = this.modelClass.getRelations()[name]
    if (!modelRelation) {
      throw new ControllerError(this, `Relation "${name}" not found.`)
    }
    const relationController = new RelationController(this, modelRelation)

    const setupInheritance = key => {
      let object = relation
      while (object !== Object.prototype) {
        const parent = Object.getPrototypeOf(object)
        if (object.hasOwnProperty(key)) {
          const values = object[key]
          const parentValues = parent[key] || relationController[key]
          if (parentValues) {
            Object.setPrototypeOf(values, parentValues)
          }
        }
        object = parent
      }
      relationController[key] = this.filterValues(relation[key])
    }

    setupInheritance('collection')
    setupInheritance('model')
    return relationController
  }
}
