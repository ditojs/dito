import objection from 'objection'
import pluralize from 'pluralize'
import { isObject, camelize } from '@ditojs/utils'
import { ControllerError } from '@/errors'
import { CollectionController } from './CollectionController'
import { RelationController } from './RelationController'
import { setupPropertyInheritance } from '@/utils'

export class ModelController extends CollectionController {
  initialize() {
    super.initialize(true)
    this.modelClass = this.modelClass ||
      this.app.models[camelize(pluralize.singular(this.name), true)]
    this.relations = this.setupRelations('relations')
  }

  setupRelations(type) {
    // Inherit `relations` from the controller and / or its sub-classes,
    // then build inheritance chains for each relation object through
    // `setupPropertyInheritance()`, before creating the relation controllers,
    // which then carry on with setting up inheritance for their actions.
    const definitions = this.inheritValues(type)
    for (const name in definitions) {
      const definition = setupPropertyInheritance(definitions, name)
      if (isObject(definition)) {
        definitions[name] = this.setupRelation(definition, name)
      } else {
        throw new ControllerError(this, `Invalid relation '${name}'.`)
      }
    }
    return definitions
  }

  setupRelation(definition, name) {
    const relation = this.modelClass.getRelations()[name]
    if (!relation) {
      throw new ControllerError(this, `Relation '${name}' not found.`)
    }
    return new RelationController(this, relation, definition)
  }

  // @override
  execute(transaction, ctx, modify) {
    // NOTE: ctx is required by RelationController.execute()
    const call = modelClass => modify(
      modelClass.query()
        .modify(this.applyScope)
    )
    return transaction
      ? objection.transaction(this.modelClass, call)
      : call(this.modelClass)
  }
}
