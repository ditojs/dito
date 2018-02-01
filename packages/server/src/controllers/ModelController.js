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
    const definitions = this.inheritValues(type, this[type])
    for (const name in definitions) {
      const definition = definitions[name]
      if (isObject(definition)) {
        definitions[name] = this.setupRelation(definition, name)
      } else {
        throw new ControllerError(this, `Invalid relation "${name}".`)
      }
    }
    return definitions
  }

  setupRelation(definition, name) {
    const relation = this.modelClass.getRelations()[name]
    if (!relation) {
      throw new ControllerError(this, `Relation "${name}" not found.`)
    }
    return new RelationController(this, relation, definition)
  }
}
