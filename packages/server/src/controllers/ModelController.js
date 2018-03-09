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
    this.relations = this.setupRelations()
  }

  setupRelations() {
    // Inherit `relations` from the controller and / or its sub-classes,
    // then build inheritance chains for each relation object through
    // `setupPropertyInheritance()`, before creating the relation controllers,
    // which then carry on with setting up inheritance for their actions.
    const relations = this.inheritValues('relations', true)
    for (const name in relations) {
      const relation = setupPropertyInheritance(relations, name)
      if (isObject(relation)) {
        relations[name] = this.setupRelation(relation, name)
      } else {
        throw new ControllerError(this, `Invalid relation '${name}'.`)
      }
    }
    return relations
  }

  setupRelation(object, name) {
    const relationInstance = this.modelClass.getRelations()[name]
    const relationDefinition = this.modelClass.definition.relations[name]
    if (!relationInstance || !relationDefinition) {
      throw new ControllerError(this, `Relation '${name}' not found.`)
    }
    return new RelationController(
      this, object, relationInstance, relationDefinition
    )
  }

  // @override
  execute(transacted, ctx, modify) {
    // NOTE: ctx is required by RelationController.execute()
    const execute = trx => modify(
      this.modelClass
        .query(trx)
        .modify(query => this.handleScopes(query))
    )

    return transacted
      ? objection.transaction(this.modelClass.knex(), trx => execute(trx))
      : execute()
  }
}
